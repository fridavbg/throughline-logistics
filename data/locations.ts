/** Places used by the seed shipments: our sites, the ports, and customer addresses. */
import type { Location } from "@/lib/types";

export const places = {
  terrassa: { name: "Terrassa Plant", country: "ES", kind: "site" },
  zaragoza: { name: "Zaragoza Warehouse", country: "ES", kind: "site" },
  porto: { name: "Porto Plant", country: "PT", kind: "site" },

  valencia: { name: "Port of Valencia", country: "ES", kind: "port" },
  barcelona: { name: "Port of Barcelona", country: "ES", kind: "port" },
  leixoes: { name: "Port of Leixões", country: "PT", kind: "port" },
  hamburg: { name: "Port of Hamburg", country: "DE", kind: "port" },
  southampton: { name: "Port of Southampton", country: "GB", kind: "port" },
  rotterdam: { name: "Port of Rotterdam", country: "NL", kind: "port" },

  ostrelHamburg: { name: "Ostrel Deutschland, Hamburg", country: "DE", kind: "customer" },
  thornquistManchester: { name: "Thornquist Tools, Manchester", country: "GB", kind: "customer" },
  thornquistBirmingham: { name: "Thornquist Tools, Birmingham", country: "GB", kind: "customer" },
  thornquistLeeds: { name: "Thornquist Tools, Leeds", country: "GB", kind: "customer" },
  calveraValencia: { name: "Calvera Suministros, Valencia", country: "ES", kind: "customer" },
  calveraMurcia: { name: "Calvera Suministros, Murcia", country: "ES", kind: "customer" },
  pellowRotterdam: { name: "Pellow Machinery, Rotterdam", country: "NL", kind: "customer" },
} satisfies Record<string, Location>;
