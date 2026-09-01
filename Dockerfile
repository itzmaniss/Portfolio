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

# Build the stylesheet from public/input.css so the image never ships a
# stale committed styles.css.
RUN bun run build:css

# Expose the port your app runs on
EXPOSE 6969

# Set environment variables (these will be overridden by Render)
# ENV RESEND_API_KEY="your-resend-api-key-here"

# Add health check using bun (which is available in the image)
HEALTHCHECK --interval=600s --timeout=10s --start-period=30s --retries=3 \
  CMD bun -e "const res = await fetch('http://localhost:6969/health'); process.exit(res.ok ? 0 : 1)" || exit 1

# Start the application
CMD ["bun", "run", "./src/index.ts"]