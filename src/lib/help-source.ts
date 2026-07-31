import { loader } from "fumadocs-core/source";
import { help } from "../../.source/server";

export const helpSource = loader({
  baseUrl: "/help",
  source: help.toFumadocsSource(),
});
