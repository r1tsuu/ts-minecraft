import { PGlite } from "@electric-sql/pglite";

const initDatabase = async () => {
  const db = new PGlite("idb://minecraft_worker_db");
};
