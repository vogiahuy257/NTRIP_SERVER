<?php

namespace App\Console\Commands;

use App\Services\Ntrip\NtripCaster;
use Illuminate\Console\Command;
use RuntimeException;
use Throwable;

class NtripServeCommand extends Command
{
    protected $signature = 'ntrip:serve';

    protected $description =
        'Start the NTRIP TCP caster server';

    public function handle(
        NtripCaster $caster
    ): int {
        if (!extension_loaded('pcntl')) {
            throw new RuntimeException(
                'The PCNTL extension is required to run the NTRIP caster.'
            );
        }

        pcntl_async_signals(true);

        pcntl_signal(
            SIGINT,
            function () use ($caster): void {
                $this->newLine();
                $this->warn('SIGINT received. Shutting down...');

                $caster->requestShutdown(
                    'daemon_shutdown_sigint'
                );
            }
        );

        pcntl_signal(
            SIGTERM,
            function () use ($caster): void {
                $this->newLine();
                $this->warn('SIGTERM received. Shutting down...');

                $caster->requestShutdown(
                    'daemon_shutdown_sigterm'
                );
            }
        );

        try {
            $caster->run(
                function (string $message): void {
                    $this->line(
                        sprintf(
                            '[%s] %s',
                            now()->format('Y-m-d H:i:s'),
                            $message
                        )
                    );
                }
            );

            return self::SUCCESS;
        } catch (Throwable $exception) {

            $caster->requestShutdown(
                'daemon_exception'
            );
            
            report($exception);

            $this->error(
                $exception->getMessage()
            );

            return self::FAILURE;
        }
    }
}