# Security notes

Report a suspected vulnerability privately to the project owner rather than
opening an issue containing credentials or private repository data.

The adapter intentionally limits its trust boundary to the official GitHub
CLI on `github.com`. It does not accept arbitrary commands, URLs, hosts, or
environment-provided arguments. Authentication is delegated to `gh`; the
adapter never reads the login file or prints its contents.

When adding an operation, preserve the read-only default, explicit write gate,
bounded output, secret redaction, owner/name validation, and `shell: false`.
