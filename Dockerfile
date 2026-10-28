FROM oven/bun:latest

# Set working directory
WORKDIR /app

# Copy package.json and the lockfile.
# NOTE: this glob must match `bun.lock` (text format, Bun >=1.1). The old
# `bun.lockb*` glob matched nothing, so the image built with no lockfile and
# `--frozen-lockfile` then failed to resolve typescript.
COPY package.json ./
COPY bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy all files
COPY . .

# Build the static site (Astro) into dist/, so the image never ships a
# stale committed build.
RUN bun run build

# Expose the port your app runs on
EXPOSE 6969

# Set environment variables at runtime, e.g.
#   docker run -e RESEND_API_KEY=re_xxx -p 6969:6969 portfolio

# Add health check using bun (which is available in the image)
HEALTHCHECK --interval=600s --timeout=10s --start-period=30s --retries=3 \
  CMD bun -e "const res = await fetch('http://localhost:6969/health'); process.exit(res.ok ? 0 : 1)" || exit 1

# Start the application: server.ts serves dist/ and /api/contact
CMD ["bun", "run", "./server.ts"]
