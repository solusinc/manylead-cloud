import { cx } from "class-variance-authority";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: Parameters<typeof cx>) => twMerge(cx(inputs));

export * from "./alert";
export * from "./alert-dialog";
export * from "./avatar";
export * from "./badge";
export * from "./breadcrumb";
export * from "./button";
export * from "./card";
export * from "./collapsible";
export * from "./dropdown-menu";
export * from "./field";
export * from "./form";
export * from "./input";
export * from "./label";
export * from "./popover";
export * from "./scroll-area";
export * from "./select";
export * from "./separator";
export * from "./sheet";
export * from "./sidebar";
export * from "./skeleton";
export * from "./table";
export * from "./tabs";
export * from "./textarea";
export * from "./tooltip";
