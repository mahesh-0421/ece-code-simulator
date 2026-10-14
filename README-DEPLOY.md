# ECE Code Simulator — deployment guide

This application serves its frontend and `/run` API from one Express server. Docker installs GNU Octave and Icarus Verilog (`iverilog` + `vvp`).

## Before publishing

This is an educational prototype that executes submitted MATLAB/Octave and Verilog code. A process timeout and non-root container are useful safeguards, but are **not a complete hostile-code sandbox**. Octave code can call system commands and may inspect files available to the app user. Do not advertise it as safe for unrestricted anonymous use until you add a stronger isolated execution service (separate disposable container per run, no secrets, restricted network, CPU/memory/PID limits, and per-IP rate limits). Never add API keys or secrets to this image.

## Test locally

1. Install Docker Desktop and start it.
2. Open a terminal in the `ECE` project folder (the folder containing this Dockerfile).
3. Build the image:

   ```bash
   docker build -t ece-code-simulator .
   ```

4. Run it:

   ```bash
   docker run --rm -p 10000:10000 ece-code-simulator
   ```

5. Open `http://localhost:10000/` and check `http://localhost:10000/health`.
6. Test one simple Octave script and one Verilog testbench in the UI. Check the browser developer console and Docker logs if a run fails.

## Publish on GitHub

1. Create a new GitHub repository, for example `ece-code-simulator`.
2. Upload the contents of this folder (not the ZIP file containing this folder).
3. Confirm that `Dockerfile`, `render.yaml`, `package.json`, `package-lock.json`, `backend/`, and `frontend/` are at the repository root. Do not commit `.env`, `node_modules`, temporary files, or compiled binaries.

## Deploy on Render (free tier, if available to your account)

1. Sign in at https://render.com/ and choose **New → Blueprint** if you want Render to use `render.yaml`, or choose **New → Web Service** and connect the repository.
2. Select the Docker runtime / Dockerfile deployment method. The Dockerfile must be at the repository root.
3. Choose the Free plan if it is offered. The first build may take a while because Octave has substantial system dependencies.
4. Ensure the health check path is `/health`, then deploy.
5. After a successful deployment, Render shows your actual public `https://....onrender.com` address. Do not guess the URL; copy the one shown in the dashboard.
6. Open the public URL and `/health`. Then test both simulator modes.

## Important free-tier limitations

Free services may sleep after inactivity, so the first request can take around a minute to wake. The filesystem is ephemeral; temporary files and any user-created files should not be treated as permanent storage. Build size, memory, and execution speed may be limiting for Octave simulations.

## Current execution limits

The runner applies an 8-second child-process timeout and 2 MiB output buffer. These limits help with runaway jobs but are not a substitute for a robust sandbox. Review `backend/simulator.js` and the UI after every change.
