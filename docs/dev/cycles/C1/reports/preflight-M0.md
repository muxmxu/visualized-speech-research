# M0 environment preflight

## Verified

- The selected temporary interpreter is CPython 3.12.14 on Linux aarch64, created with `uv venv --python 3.12` under the state directory's `tmp/m0-preflight/venv`.
- `uv pip install` installed torch 2.15.0+cpu from `https://download.pytorch.org/whl/cpu` and the DESIGN §18 mandatory Python packages and development/build tools from the package index.
- Individual imports succeeded for torch 2.15.0+cpu, numpy 2.5.5, scipy 1.18.1, soundfile 0.14.0, sounddevice 0.5.6, librosa 1.0.1, fastapi 0.163.1, uvicorn 0.54.0, pytest 9.2.0, ruff 0.17.5, httpx 0.28.1 and hatchling 1.33.0.
- `uv pip check --python <temporary-venv>/bin/python` checked 65 packages and reported all installed packages compatible.
- The temporary torch CPU build reports `torch.version.cuda = None`, `cuda.is_available() = False`, and MPS built/available both false; a CPU float32 tensor squared to `[1.0, 4.0]`.
- A Python `HTTPServer` bound to `127.0.0.1` with port 0 obtained port 39621; a local urllib request returned HTTP 200 and `loopback-ok`, then the request thread joined and the server closed.
- Node 26.13.1 and npm 11.20.0 installed the §18 frontend packages and the TypeScript 6.0.x constraint in an isolated temporary package; `npm ci` installed 214 packages successfully.
- The installed frontend versions are react/react-dom 19.3.1, @tabler/icons-react 3.52.0, @mantine/core/hooks/notifications 9.8.1, dockview 8.9.0, uplot 1.6.32, ag-grid-community/ag-grid-react 36.3.0, zustand 5.1.0, typescript 6.0.3, vite 8.3.8, vitest 5.1.0 and @playwright/test 1.65.1.
- Additional development packages were @types/react and @types/react-dom 19.3.0, eslint 10.15.0, typescript-eslint 8.73.0, eslint-plugin-react-hooks 7.1.1 and eslint-plugin-react-refresh 0.5.8.
- `tsc --noEmit` passed for a strict temporary React entry point using bundler module resolution and `skipLibCheck`; `vite build` successfully transformed 7,495 modules with all named runtime packages imported and produced a bundle, while emitting Mantine `use client` directive and chunk-size warnings.
- `vitest --version`, `playwright --version` and `npm ls --depth=0` succeeded; this establishes tool installation, not browser launch or application tests.

## Unresolved and limits

- This is a temporary dependency combination, not the project's eventual lockfile or proof that the final implementation passes its checks.
- Optional pyworld, safetensors and matplotlib extras were not installed or checked.
- A CPU-only torch build cannot determine CUDA hardware availability independently of that build, and this probe does not substitute for the project device self-check.
- Playwright browser launch, Web Audio, and final project tests were not tested in this preflight.

## Root npm incident

- The first npm installation was run from the temporary frontend directory before creating its own `package.json`; npm searched upward and modified the pre-existing untracked root `package.json` and `package-lock.json`, and created root `node_modules`.
- The second npm installation was stopped on discovery; the newly created root `node_modules` was removed.
- The two root files were reconstructed from the recon report's description of the pre-existing empty package and empty packages object, with the standard six-line npm lockfile fields; no prior byte-for-byte backup was available, so exact restoration cannot be established.
- Subsequent npm operations used a temporary directory containing its own `package.json` and an npm cache within the state directory.
