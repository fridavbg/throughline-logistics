/**
 * Reference data for the demo: sites, customers, operators and personas.
 * Everything here is invented. Spec: docs/DATA_MODEL.md §3.
 */
import type { Customer, Operator, Site, User } from "@/lib/types";

/** The factories and warehouses shipments leave from. */
export const sites: Site[] = [
  { id: "site-terrassa", name: "Terrassa Plant", type: "factory", country: "ES" },
  { id: "site-zaragoza", name: "Zaragoza Warehouse", type: "warehouse", country: "ES" },
  { id: "site-porto", name: "Porto Plant", type: "factory", country: "PT" },
];

/** The companies shipments go to. Ostrel Deutschland is our own subsidiary. */
export const customers: Customer[] = [
  {
    id: "cust-ostrel-de",
    name: "Ostrel Deutschland",
    type: "subsidiary",
    country: "DE",
    priority: "key",
  },
  {
    id: "cust-pellow",
    name: "Pellow Machinery BV",
    type: "customer",
    country: "NL",
    priority: "standard",
  },
  {
    id: "cust-calvera",
    name: "Calvera Suministros",
    type: "customer",
    country: "ES",
    priority: "standard",
  },
  {
    id: "cust-thornquist",
    name: "Thornquist Tools Ltd",
    type: "customer",
    country: "GB",
    priority: "key",
  },
];

/**
 * The logistics companies moving our shipments. Each one reports in its own format.
 * A fourth operator, Brennick Freight, is added later together with its feed (#21).
 */
export const operators: Operator[] = [
  { id: "op-corvala", name: "Corvala Transport", modes: ["road"] },
  { id: "op-saltwren", name: "Saltwren Lines", modes: ["sea"] },
  { id: "op-quickfern", name: "Quickfern", modes: ["road"] },
];

/**
 * The personas on the demo login screen: a customer, an ops user for one site,
 * and a support lead who sees every site.
 */
export const users: User[] = [
  { id: "user-summer", name: "Summer", role: "customer", customerId: "cust-ostrel-de" },
  { id: "user-morty", name: "Morty", role: "ops", siteIds: ["site-terrassa"] },
  { id: "user-rick", name: "Rick", role: "ops", siteIds: "all" },
];
