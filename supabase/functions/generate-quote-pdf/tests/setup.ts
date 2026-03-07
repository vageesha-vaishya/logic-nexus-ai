
global.Deno = {
  env: {
    get: (key: string) => process.env[key],
    toObject: () => process.env,
  },
};
