/**
 * Windows shell argument escaping utilities.
 *
 * When using `spawn(cmd, { shell: true })`, arguments must be escaped
 * to prevent shell metacharacter injection (`&`, `|`, `;`, etc.).
 */

/** Characters that have special meaning in cmd.exe */
const CMD_META_CHARS = /[&|<>^%()";!]/;

/**
 * Escape a single argument for safe use in a Windows cmd.exe shell command.
 * - Wraps the argument in double quotes
 * - Escapes internal double quotes by doubling them
 * - Escapes cmd.exe metacharacters with `^` inside the quoted string
 */
export function escapeShellArgWindows(arg: string): string {
  if (arg === "") return '""';

  // If the arg contains no spaces and no metacharacters, return as-is
  if (!arg.includes(" ") && !arg.includes('"') && !CMD_META_CHARS.test(arg)) {
    return arg;
  }

  // Escape internal double quotes by doubling them
  let escaped = arg.replace(/"/g, '""');

  // Escape cmd.exe metacharacters with ^ (even inside quotes, some are interpreted)
  escaped = escaped.replace(/([&|<>^%])/g, "^$1");

  return `"${escaped}"`;
}

/**
 * Build a safe shell command string from an array of arguments.
 * Each argument is individually escaped before joining.
 */
export function buildSafeShellCmd(args: string[]): string {
  return args.map(escapeShellArgWindows).join(" ");
}
