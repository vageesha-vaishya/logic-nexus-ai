export interface RouteResult {
  queue: string;
  sla_minutes: number;
}

export interface RoutingInput {
  category?: string;
  sentiment?: string;
  intent?: string;
}

export const determineRoute = (payload: RoutingInput): RouteResult => {
    let queue = "support_general";
    let sla_minutes = 60;
    
    const category = payload.category;
    const sentiment = payload.sentiment;
    const intent = payload.intent;

    if (category === "feedback" && (sentiment === "negative" || sentiment === "very_negative")) {
      queue = "cfm_negative";
      sla_minutes = 30;
    } else if (category === "crm" && sentiment === "very_negative") {
      queue = "support_priority";
      sla_minutes = 15;
    } else if (intent === "sales") {
      queue = "sales_inbound";
      sla_minutes = 120;
    }

    return { queue, sla_minutes };
};
