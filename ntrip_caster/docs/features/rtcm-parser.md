# Đặc tả: RTCM3 Parser

## Mục tiêu

Phân tích stream byte RTCM3 để xác định frame hợp lệ, message type và lỗi CRC mà không yêu cầu các lần đọc TCP trùng với ranh giới frame.

## Đặc điểm RTCM3

- Preamble: `0xD3`.
- Length nằm trong header 10 bit.
- CRC-24Q ở cuối frame.
- TCP chunk có thể chứa nửa frame, một frame hoặc nhiều frame.

## Yêu cầu parser

- Giữ phần frame chưa hoàn chỉnh giữa các lần `push`.
- Resync khi byte không phải preamble.
- Không đọc vượt length hợp lệ.
- Tính CRC-24Q và đếm lỗi.
- Trích message type khi đủ payload.
- Không ném exception làm dừng Caster vì một frame hỏng.

## Metrics

- `valid_rtcm_frames`.
- `rtcm_crc_errors`.
- Bytes nhận/chuyển.
- Có thể mở rộng message type distribution.

## Tiêu chí nghiệm thu

- Parse đúng frame bị chia qua nhiều chunks.
- Parse nhiều frame trong một chunk.
- Frame CRC sai tăng counter nhưng parser tiếp tục resync.
- Memory buffer có giới hạn và không tăng vô hạn với dữ liệu rác.
