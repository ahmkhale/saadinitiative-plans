export function flagValue(args, name) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function positionalJson(args) {
  return args.find((arg, index) => !arg.startsWith("--") && (index === 0 || !args[index - 1]?.startsWith("--")) && /\.json$/i.test(arg));
}
