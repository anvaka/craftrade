// Stand-ins for Node modules the server imports but the solo world never
// calls: the file system, worker threads, the native database driver and
// the static file server. The build points those imports here (vite.config.ts).

const never = (what: string) => (): never => {
  throw new Error(`${what} is not available in the solo world.`);
};

// node:fs
export const existsSync = (): boolean => false;
export const mkdirSync = (): void => {};
// node:path
export const dirname = (p: string): string => p;
// node:worker_threads
export class Worker {
  constructor() {
    never('A worker thread')();
  }
}
export const parentPort = null;
// @hono/node-server/serve-static
export const serveStatic = never('The static file server');
// better-sqlite3
export default class Database {
  constructor() {
    never('The native database')();
  }
}
