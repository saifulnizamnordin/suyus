// Data for the "fpga-cicd" showcase on /p/saifulnizamnordin.
// Image names, layers and job types are illustrative.
export const fpgaPlatform = {
  "title": "FPGA CI/CD Platform",
  "summary": "Designed and operate the CI/CD platform behind FPGA application implementation: a fleet of 42 fully Dockerized runners, a container registry holding every toolchain and dependency image the FPGA builds need, a live status dashboard for the infrastructure, and a Kubernetes cluster hosting the supporting CI/CD tools such as SonarQube.",
  "runners": {
    "count": 42,
    "coresEach": 32,
    "memoryGbEach": 32,
    "executor": "Docker"
  },
  "jobTypes": [
    "synthesis",
    "place & route",
    "bitstream",
    "C++ build",
    "Qt build",
    "unit tests",
    "cross-compile"
  ],
  "registryImages": [
    {
      "name": "fpga/base",
      "purpose": "Common OS base with shared system libraries, used by every other image.",
      "layers": [
        "OS base",
        "System libraries",
        "Build essentials"
      ]
    },
    {
      "name": "fpga/cpp-toolchain",
      "purpose": "Modern C++ toolchain for the application core.",
      "layers": [
        "fpga/base",
        "GCC / Clang",
        "CMake + Ninja",
        "Ccache",
        "TBB"
      ]
    },
    {
      "name": "fpga/qt-build",
      "purpose": "Qt build environment for the desktop tooling and GUI.",
      "layers": [
        "fpga/cpp-toolchain",
        "Qt SDK",
        "Qt build dependencies"
      ]
    },
    {
      "name": "fpga/mingw-cross",
      "purpose": "Cross-compiles Windows binaries from Linux runners.",
      "layers": [
        "fpga/cpp-toolchain",
        "MinGW64",
        "MSYS2 packages",
        "UCRT runtime"
      ]
    },
    {
      "name": "fpga/implementation",
      "purpose": "FPGA implementation flow: synthesis, place & route and bitstream generation.",
      "layers": [
        "fpga/base",
        "FPGA vendor toolchain",
        "Device support files",
        "Flow scripts"
      ]
    }
  ],
  "k8sTools": [
    {
      "name": "SonarQube",
      "role": "Static analysis and quality gate for every merge request."
    }
  ]
}
