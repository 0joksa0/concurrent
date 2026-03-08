cmake_minimum_required(VERSION 3.10)

set(CMAKE_C_STANDARD 99)
project(concurrent C)

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/out/${CMAKE_BUILD_TYPE})

enable_testing()

add_executable(concurrent src/main.c)
target_include_directories(concurrent PRIVATE ${CMAKE_SOURCE_DIR}/include)

file(GLOB_RECURSE EXTRA_SOURCES "src/*.c")
list(REMOVE_ITEM EXTRA_SOURCES "${CMAKE_SOURCE_DIR}/src/main.c")
target_sources(concurrent PRIVATE ${EXTRA_SOURCES})


option(BUILD_TESTS "Build Criterion tests" OFF)
if(BUILD_TESTS)
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(CRITERION REQUIRED criterion)

    add_executable(tests
        tests/test_main.c
        ${EXTRA_SOURCES})
    
    target_include_directories(tests PRIVATE ${CRITERION_INCLUDE_DIRS})
    target_link_libraries(tests PRIVATE ${CRITERION_LIBRARIES})

    add_test(NAME unit COMMAND tests)
endif()


# ───── coverage (only for GCC/Clang) ─────
option(COVERAGE "Enable coverage flags" OFF)
if(COVERAGE AND CMAKE_C_COMPILER_ID MATCHES "GNU|Clang")
    target_compile_options(concurrent PRIVATE
        -O0 -g --coverage)
    target_link_options(concurrent PRIVATE --coverage)
    if(TARGET tests)
        target_compile_options(tests PRIVATE -O0 -g --coverage)
        target_link_options(tests PRIVATE --coverage)
    endif()
endif()


install(TARGETS concurrent 
        RUNTIME DESTINATION bin)

install(DIRECTORY include/
        DESTINATION include
        FILES_MATCHING PATTERN "*.h")

find_package(Python3 COMPONENTS Interpreter)
if(Python3_Interpreter_FOUND)
    add_custom_target(viz_nodes
        COMMAND ${Python3_EXECUTABLE} ${CMAKE_SOURCE_DIR}/scripts/extract_viz_nodes.py
                --root ${CMAKE_SOURCE_DIR}
                --output ${CMAKE_SOURCE_DIR}/nodes.json
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
        COMMENT "Extracting @viz-node annotations into nodes.json")
endif()
