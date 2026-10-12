// Builds the parameters for one YouTube search. Pure, so it can be tested.
import { SEARCH_LANGUAGE } from "./config.js";

// regionCode is only added for the region search; the global search leaves it out.
export function buildSearchParams(query, { after, before, max, regionCode }) {
  return {
    part: "snippet",
    type: "video",
    order: "viewCount",
    publishedAfter: after,
    publishedBefore: before,
    maxResults: max,
    q: query,
    regionCode,
    relevanceLanguage: SEARCH_LANGUAGE,
  };
}
