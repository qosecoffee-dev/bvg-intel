const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbwftS8e89ttxlhv9ZmJ9zqm000lMTs1mzB_cTLiPO6L68WaotWHQQScmPJsUGgjqjWo/exec";
if (DEFAULT_API_URL.startsWith("https://script.google.com/")) {
  localStorage.setItem("bvg_intel_api_url", DEFAULT_API_URL);
}
