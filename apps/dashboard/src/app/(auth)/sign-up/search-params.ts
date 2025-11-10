import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  callbackURL: parseAsString.withDefault("/"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
