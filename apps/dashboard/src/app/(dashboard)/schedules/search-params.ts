import {
  createParser,
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";

const SCHEDULED_STATUS = [
  "pending",
  "processing",
  "sent",
  "failed",
  "cancelled",
] as const;

// Custom parser for date
const parseAsDate = createParser<Date>({
  parse(queryValue) {
    const date = new Date(queryValue);
    return isNaN(date.getTime()) ? null : date;
  },
  serialize(value) {
    return value.toISOString().split("T")[0] ?? "";
  },
});

export const searchParamsParsers = {
  view: parseAsStringEnum(["calendar", "list"] as const).withDefault(
    "calendar",
  ),
  status: parseAsStringEnum([...SCHEDULED_STATUS]),
  month: parseAsString,
  dateFrom: parseAsDate,
  dateTo: parseAsDate,
  page: parseAsInteger.withDefault(1),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
