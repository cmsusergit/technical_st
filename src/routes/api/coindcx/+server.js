import { json } from '@sveltejs/kit';
// 
// Define the base URLs for CoinDCX APIs
// NOTE: For testing purposes, we'll try a common SPOT market pair first if futures consistently fail.
// If your goal is strictly futures, keep these URLs, but be aware of public access limitations.
const COINDX_FUTURES_CANDLES_API_BASE = 'https://public.coindcx.com/market_data/candles';
const COINDX_FUTURES_INSTRUMENT_API_BASE = 'https://api.coindcx.com/exchange/v1/derivatives/futures/data/instrument';

export async function GET({ url }) {
    try {
        const type = url.searchParams.get('type');
        const pair = url.searchParams.get('pair');

        const interval = url.searchParams.get('interval');
        const limit = url.searchParams.get('limit');

        console.log(`[Proxy] Received client request: type=${type}, pair=${pair}, interval=${interval}, limit=${limit}`);
        if (!type || !pair) {
            console.error('[Proxy] Missing required parameters: type or pair');
            return json({ error: 'Missing required parameters: type and pair' }, { status: 400 });
        }
        let apiUrl = '';
        if (type === 'candles') {
            if (!interval || !limit) {
                console.error('[Proxy] Missing required parameters for candles: interval and limit');
                return json({ error: 'Missing required parameters for candles: interval and limit' }, { status: 400 });
            }
            apiUrl = `${COINDX_FUTURES_CANDLES_API_BASE}?pair=${pair}&interval=${interval}&limit=${limit}`;
        } else if (type === 'instrument') {
            apiUrl = `${COINDX_FUTURES_INSTRUMENT_API_BASE}?pair=${pair}`;
        } else {
            console.error(`[Proxy] Invalid type parameter: ${type}`);
            return json({ error: 'Invalid type parameter. Must be "candles" or "instrument"' }, { status: 400 });
        }

        console.log(`[Proxy] Making external request to: ${apiUrl}`);
        const response = await fetch(apiUrl);
        console.log(`[Proxy] External API response status: ${response.status}`);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[Proxy] Error from CoinDCX API (${apiUrl}): ${response.status} - Body: "${errorBody.substring(0, 200)}..."`);
            return json({
                error: `Failed to fetch data from CoinDCX: Status ${response.status}. Response: ${errorBody}`
            }, { status: response.status });
        }
        const data = await response.json();
        console.log(`[Proxy] Successfully fetched data for type=${type}, pair=${pair}.`);
        return json(data);
    } catch (error) {
        console.error('[Proxy] Internal server error:', error);
        // Ensure this always returns JSON, even for unexpected parsing errors
        return json({ error: `Internal server error during proxy request: ${error.message}` }, { status: 500 });
    }
}