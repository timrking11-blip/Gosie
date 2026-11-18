import { useRef, useState, type FormEvent } from "react";
import { apiRequest } from "@workspace/api-client-react";
import { ExternalLink, Info, Search, ShieldCheck, Trash2 } from "lucide-react";

type SearchResult = { id: string; title: string; url: string; description: string; publisher: string; age: string | null };
type SearchResponse = { retrievedAt: string; category: string; results: SearchResult[] };
const categories = [
  ["arts", "Arts, museums and theater"], ["community", "Community events"], ["food", "Food events"],
  ["festivals", "Festivals and fairs"], ["markets", "Farmers markets"], ["learning", "Workshops and learning"],
  ["music", "Live music"], ["news", "Local news and event calendars"], ["outdoors", "Outdoor activities"], ["sports", "Sports and recreation"],
] as const;
const localDay = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export default function LiveDiscoverySearch() {
  const [region, setRegion] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number][0]>("arts");
  const [accepted, setAccepted] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestInFlight = useRef(false);

  function clearResult() {
    setResult(null); setError("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current || !accepted) return;
    requestInFlight.current = true;
    clearResult(); setBusy(true);
    try {
      const response = await apiRequest<SearchResponse>("/discoveries/search", {
        method: "POST",
        body: { region: region.trim(), startDate, endDate, category, termsAccepted: accepted },
      });
      setResult(response);
      if (!response.results.length) setError("No public search results were returned. Try a broader region, another category, or different dates.");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "";
      setError(code === "discovery_search_not_enabled"
        ? "Live public search is not enabled for this Gosie environment."
        : code === "search_rate_limited"
          ? "You have reached the current search limit. Please wait before searching again."
          : code === "invalid_discovery_search"
            ? "Enter a city or broad region, a date window of up to 31 days, and accept the search-use notice."
            : "The public search is temporarily unavailable. Your search was not saved.");
    } finally { requestInFlight.current = false; setBusy(false); }
  }

  return <section className="live-discovery-search research-discoveries" aria-labelledby="live-discovery-heading">
    <div className="live-discovery-heading">
      <div><span className="product-eyebrow">On-demand · separate from your profile</span>
        <h2 id="live-discovery-heading">Search public event sources</h2></div>
      <Search size={20} aria-hidden="true" />
    </div>
    <p>Search only when you choose. Results are public-web leads, not verified event listings, recommendations, or ticket availability. Nothing from your Gosie profile is sent.</p>
    <form className="live-discovery-form" onSubmit={submit}>
      <label>City or broad region
        <input required minLength={2} maxLength={100} value={region} autoComplete="off"
          placeholder="For example, Brooklyn, NY" onChange={(event) => { setRegion(event.target.value); clearResult(); }} />
      </label>
      <div className="live-discovery-dates">
        <label>From
          <input required type="date" min={localDay()} value={startDate}
            onChange={(event) => { setStartDate(event.target.value); clearResult(); }} />
        </label>
        <label>Through
          <input required type="date" min={startDate || localDay()} value={endDate}
            onChange={(event) => { setEndDate(event.target.value); clearResult(); }} />
        </label>
      </div>
      <label>What would you like to explore?
        <select value={category} onChange={(event) => { setCategory(event.target.value as typeof category); clearResult(); }}>
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <p className="live-discovery-privacy"><Info size={16} aria-hidden="true" />
        <span>When you submit, Gosie sends Brave your city/region, date window, and category search. Gosie does not send your profile, interests, budget, travel limits, or account identity. Brave processes the search query. Searches and results are not saved by Gosie; results remain only in this page until you clear them, leave, or reload.</span>
      </p>
      <label className="live-discovery-consent">
        <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
        <span>I agree to use these search results only for my current discovery: I will not save, cache, redistribute, or use them to train AI models.</span>
      </label>
      <p className="live-discovery-terms">Brave Search web requests are listed at $5 per 1,000 requests with $5 monthly credits; the connected account’s actual plan may differ. Each search is a provider request. Read the <a href="https://api-dashboard.search.brave.com/documentation/resources/terms-of-service" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Brave API terms</a> and <a href="https://api-dashboard.search.brave.com/documentation/pricing" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">pricing</a>.</p>
      <button className="product-primary live-discovery-submit" type="submit" disabled={busy || !accepted}>
        <Search size={16} aria-hidden="true" /> {busy ? "Searching public sources…" : "Search public sources"}
      </button>
    </form>
    {busy && <p role="status">Searching public sources. Your search details are not saved.</p>}
    {error && <p className="live-discovery-message" role={result ? "status" : "alert"}>{error}</p>}
    {result && <>
      <div className="live-discovery-results-heading">
        <p><strong>{result.results.length}</strong> source leads · retrieved {new Date(result.retrievedAt).toLocaleString()}</p>
        <button type="button" className="text-button" onClick={clearResult}><Trash2 size={15} aria-hidden="true" /> Clear results</button>
      </div>
      {result.results.length > 0 && <p className="live-discovery-ranking"><ShieldCheck size={15} aria-hidden="true" />
        Shown in the provider’s search order for “{categories.find(([value]) => value === result.category)?.[1]}.” This is not a personal fit score.</p>}
      <div className="live-discovery-results">
        {result.results.map((item) => <article key={item.id} className="live-discovery-result">
          <p className="live-discovery-facts"><strong>Public search result · date, price, availability, accessibility and travel are unverified</strong></p>
          <h3>{item.title}</h3>
          <p className="live-discovery-publisher">{item.publisher}{item.age ? ` · page age reported by source: ${item.age}` : " · page age unknown"}</p>
          {item.description && <p>{item.description}</p>}
          <a href={item.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
            Check original source <ExternalLink size={14} aria-hidden="true" />
          </a>
        </article>)}
      </div>
    </>}
  </section>;
}
