# Distributed under the OSI-approved BSD 3-Clause License.  See accompanying
# file Copyright.txt or https://cmake.org/licensing for details.

cmake_minimum_required(VERSION ${CMAKE_VERSION}) # this file comes with cmake

# If CMAKE_DISABLE_SOURCE_CHANGES is set to true and the source directory is an
# existing directory in our source tree, calling file(MAKE_DIRECTORY) on it
# would cause a fatal error, even though it would be a no-op.
if(NOT EXISTS "/mnt/data/ntrip_edit/ntrip_cc/build_test/_deps/mavlink_headers-src")
  file(MAKE_DIRECTORY "/mnt/data/ntrip_edit/ntrip_cc/build_test/_deps/mavlink_headers-src")
endif()
file(MAKE_DIRECTORY
  "/mnt/data/ntrip_edit/ntrip_cc/build_test/_deps/mavlink_headers-build"
  "/mnt/data/ntrip_edit/ntrip_cc/build_test/_deps/mavlink_headers-subbuild/mavlink_headers-populate-prefix"
  "/mnt/data/ntrip_edit/ntrip_cc/build_test/_deps/mavlink_headers-subbuild/mavlink_headers-populate-prefix/tmp"
  "/mnt/data/ntrip_edit/ntrip_cc/build_test/_deps/mavlink_headers-subbuild/mavlink_headers-populate-prefix/src/mavlink_headers-populate-stamp"
  "/mnt/data/ntrip_edit/ntrip_cc/build_test/_deps/mavlink_headers-subbuild/mavlink_headers-populate-prefix/src"
  "/mnt/data/ntrip_edit/ntrip_cc/build_test/_deps/mavlink_headers-subbuild/mavlink_headers-populate-prefix/src/mavlink_headers-populate-stamp"
)

set(configSubDirs )
foreach(subDir IN LISTS configSubDirs)
    file(MAKE_DIRECTORY "/mnt/data/ntrip_edit/ntrip_cc/build_test/_deps/mavlink_headers-subbuild/mavlink_headers-populate-prefix/src/mavlink_headers-populate-stamp/${subDir}")
endforeach()
if(cfgdir)
  file(MAKE_DIRECTORY "/mnt/data/ntrip_edit/ntrip_cc/build_test/_deps/mavlink_headers-subbuild/mavlink_headers-populate-prefix/src/mavlink_headers-populate-stamp${cfgdir}") # cfgdir has leading slash
endif()
