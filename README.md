# NVDA Insights Studio 📈

**A self-contained stock-market analytics dashboard** by [Nazir Ali Khan](https://github.com/nazirreally), with a light, Nexora-inspired interface. Built with vanilla HTML, CSS and JavaScript. No API keys or server required.

> The application analyzes historical datasets. It is not a live quote service, stock forecast, or investment-advice platform.

## Run locally

From the project folder:

~~~bash
python -m http.server 8501
~~~

Then open http://localhost:8501 in your browser. Run these commands from this standalone repository's root directory.

## Dataset sources

**Bundled default (real NVDA history, not Kaggle):** 6,507 daily records for Jan 22, 1999–Nov 29, 2024, from [FarhanAli97's NVIDIA historical CSV](https://github.com/FarhanAli97/NVIDIA-NVDA-Stock-Data-1999-to-December-2024), under Apache-2.0. This separately sourced CSV is explicitly labelled as demonstration data. See [SOURCE.md](data/SOURCE.md).

**The Kaggle dataset you requested:** [NVIDIA Stock Historical Price by caesarmario](https://www.kaggle.com/datasets/caesarmario/nvidia-stock-historical-price). Download its CSV from Kaggle, launch the dashboard, click **Import CSV**, and the entire dashboard recalculates using that file. Kaggle does not provide a CSV through the current connection, so the bundled file is not described as that dataset.

**Expected columns:** Date, Open, High, Low, Close, Volume; optional Adj Close. Dates with ISO YYYY-MM-DD prefixes are accepted. User files are processed inside the browser; not uploaded.

## Working features

| Module | Behavior |
| --- | --- |
| Overview | Historical close, period return, annualized daily-return volatility, max drawdown |
| Period controls | 1M, 3M, 6M, 1Y, 5Y, ALL relative to the last date in the CSV |
| Price Explorer | SVG line chart, 20/50-day SMAs and OHLC candlestick alternative |
| Analytics | Daily trading-volume chart and daily-return distribution histogram |
| Dataset Doctor | Counts invalid dates, invalid prices, OHLC anomalies, bad volume, duplicates and unsorted records |
| Price Table | Recent observed OHLC and volume records, daily return |
| Reports | Calculated observations, downloadable Markdown and JSON metrics |
| CSV Export | Download complete filtered historical rows |
| Privacy | Runs entirely in your browser, no server-side file uploads |

## Calculation rules

- **Return** = last selected analysis price / first selected analysis price − 1.
- **Realized annualized volatility** = sample standard deviation of daily simple returns × √252.
- **Max drawdown** = largest decline from the rolling high within the selected date window.
- **SMA20/SMA50** = 20/50 trading-record simple averages calculated on full import history.
- **Analytics price** = Adj Close when a valid optional column exists, otherwise Close.
- **Candlesticks** = raw OHLC values as provided by the dataset.

Splits, other corporate actions, and adjustment approaches depend on the selected source. Historical patterns do not predict future returns.

## Tests

~~~bash
node --test tests/analytics.test.js
~~~

Node 20+ recommended. GitHub Actions runs the tests automatically on changes to this project.

## Project layout

~~~text
index.html
assets/styles.css
src/analytics.js
src/app.js
data/nvda-history-1999-2024.csv
data/SOURCE.md
tests/analytics.test.js
package.json
~~~

### Deployment

The project is ready for static hosting or GitHub Pages once the repository's Pages settings are configured. No hosting/deployment is claimed until the URL is verified.

**Educational use only; not financial advice.**