import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type SimpleKv = {
  get(key: string): Promise<JsonValue | undefined>;
  put(key: string, value: JsonValue): Promise<void>;
  delete(key: string): Promise<void>;
};

/** Tiny JSON-file KV for the free/no-LLM publisher (no BDK host required). */
export function createFileKv(filePath: string): SimpleKv {
  let cache: Record<string, JsonValue> | null = null;

  async function load(): Promise<Record<string, JsonValue>> {
    if (cache) return cache;
    try {
      const raw = await readFile(filePath, "utf8");
      cache = JSON.parse(raw) as Record<string, JsonValue>;
    } catch {
      cache = {};
    }
    return cache;
  }

  async function save(data: Record<string, JsonValue>): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2));
    cache = data;
  }

  return {
    async get(key) {
      const data = await load();
      return data[key];
    },
    async put(key, value) {
      const data = await load();
      data[key] = value;
      await save(data);
    },
    async delete(key) {
      const data = await load();
      delete data[key];
      await save(data);
    },
  };
}
