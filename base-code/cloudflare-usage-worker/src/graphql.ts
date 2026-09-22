import type { AiUsageQueryResult, Env, GraphQlResponse } from "./types";

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

// `datetimeHour` is requested (rather than a coarser `date` dimension, whose
// availability on this dataset isn't confirmed) and bucketed into days client-side —
// see groupUsageByDay in index.ts.
const AI_USAGE_QUERY = `
  query AiUsage($accountTag: string!, $start: Time!, $end: Time!, $limit: Int!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        aiInferenceAdaptiveGroups(
          filter: { datetime_gt: $start, datetime_lt: $end }
          limit: $limit
          orderBy: [datetimeHour_ASC]
        ) {
          count
          sum {
            totalInputTokens
            totalOutputTokens
            totalRequestBytesIn
          }
          dimensions {
            modelId
            datetimeHour
          }
        }
      }
    }
  }
`;

export async function fetchAiInferenceUsage(
  env: Env,
  since: string,
  until: string,
  limit: number
): Promise<AiUsageQueryResult> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: AI_USAGE_QUERY,
      variables: {
        accountTag: env.CF_ACCOUNT_ID,
        start: since,
        end: until,
        limit,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Cloudflare GraphQL API returned HTTP ${response.status}: ${await response.text()}`);
  }

  const json = (await response.json()) as GraphQlResponse<AiUsageQueryResult>;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  if (!json.data) {
    throw new Error("Cloudflare GraphQL API returned no data");
  }
  return json.data;
}
