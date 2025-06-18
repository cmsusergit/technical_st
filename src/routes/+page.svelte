<script>//
  // @ts-nocheck

  import { onMount } from 'svelte';

  let prices = {};
  let plotlyLoaded = false;
  let SMA_MODULE, EMA_MODULE, ATR_MODULE, RSI_MODULE, MACD_MODULE;
  let plotDiv;
  const instruments = [
    { label: 'XRP/USDT', value: 'B-XRP_USDT' },
    { label: 'BTC/USDT', value: 'B-BTC_USDT' },

    { label: 'ETH/USDT', value: 'B-ETH_USDT' },
    { label: 'DOGE/USDT', value: 'B-DOGE_USDT' } ];

  let selectedInstrument = instruments[0].value;
  const numberOfCandlesOptions = [50, 100, 150, 200, 300, 500];
  let selectedNumberOfCandles = 200;
  const indicatorOptions = [
    { label: 'SMA', value: 'sma' },
    { label: 'EMA', value: 'ema' },
    { label: 'ATR', value: 'atr' },
    { label: 'RSI', value: 'rsi' },
    { label: 'MACD', value: 'macd' },
    { label: 'Midprice', value: 'midprice' }
  ];
  let selectedIndicators = [indicatorOptions[0].value];
  const periodOptions = [7, 10, 14, 20, 50, 100, 200];
  let selectedPeriod = 14;
  let Plotly;
  let supportResistancePeriod =50;
  let supportResistanceMarginPct =0.2; 
  let prevDayHigh = null;
  let prevDayLow = null;
  let plotType = 'candlestick';
  let showRenko = false;
  let showRenkoOverlay = false;
  let showPrevDayHighLow = false;
  let renkoAtrPeriod = 14;
  const renkoAtrPeriodOptions = [7, 10, 14, 20, 50];
  let showPattrnAnnotations = false; // Disabled by default
  async function fetchCryptoData(pair) {
    try {
      const curr1 = Date.now();
      const candleDuration = 5 * 60 * 1000;
      const numberOfCandles = selectedNumberOfCandles;
      const totalCandleTime = candleDuration * numberOfCandles;
      const fromDt = curr1 - totalCandleTime;
      const to = Math.floor(curr1 / 1000);
      const from = Math.floor(fromDt / 1000);
      const url1 = `https://public.coindcx.com/market_data/candlesticks?pair=${pair}&from=${from}&to=${to}&resolution=5&pcode=f`;
      const response = await fetch(url1);
      const dt = await response.json();
      let temp1 = { x: [], open: [], close: [], high: [], low: [] };
      for (let indx = 0; indx < dt.data.length; indx++) {
        temp1.x.push(new Date(dt.data[indx].time).toLocaleTimeString());
        temp1.open.push(dt.data[indx].open);
        temp1.close.push(dt.data[indx].close);
        temp1.high.push(dt.data[indx].high);
        temp1.low.push(dt.data[indx].low);
      }
      prices = temp1;
      updatePlot();
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }
  async function fetchPrevDayHighLow(pair) {
    try {
      const now = Date.now();
      const oneHour = 60 *60 *1000;
      const twoDays = 2 *24 *oneHour;
      const fromDt = now -twoDays;
      const to = Math.floor(now / 1000);
      const from = Math.floor(fromDt / 1000);
      const url = `https://public.coindcx.com/market_data/candlesticks?pair=${pair}&from=${from}&to=${to}&resolution=60&pcode=f`;
      const response = await fetch(url);
      const dt = await response.json();
      const days = {};
      for (const candle of dt.data) {
        const d = new Date(candle.time);
        const dayKey = d.getUTCFullYear() + '-' + (d.getUTCMonth()+1) + '-' + d.getUTCDate();
        if (!days[dayKey]) days[dayKey] = [];
        days[dayKey].push(candle);
      }
      const dayKeys = Object.keys(days).sort();
      if (dayKeys.length < 2) return;
      const prevDayCandles = days[dayKeys[dayKeys.length-2]];
      prevDayHigh = Math.max(...prevDayCandles.map(c => c.high));
      prevDayLow = Math.min(...prevDayCandles.map(c => c.low));
    } catch (e) {
      prevDayHigh = null;
      prevDayLow = null;
    }
  }
  function getIndicatorData() {
    let ohlc = prices;
    if (plotType === 'heikinashi') {
      ohlc = getHeikinAshiData();
    }
    const close = ohlc.close || [];
    const high = ohlc.high || [];
    const low = ohlc.low || [];

    switch (selectedIndicator) {
      case 'sma':
        return padIndicator(SMA_MODULE.calculate({ period: selectedPeriod, values: close }), close.length);
      case 'ema':
        return padIndicator(EMA_MODULE.calculate({ period: selectedPeriod, values: close }), close.length);
      case 'atr':
        return padIndicator(ATR_MODULE.calculate({ period: selectedPeriod, high, low, close }), close.length);
      case 'rsi':
        return padIndicator(RSI_MODULE.calculate({ period: selectedPeriod, values: close }), close.length);
      case 'macd':
        const macdData = MACD_MODULE.calculate({
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
          values: close
        });
        return padIndicator(macdData.map(item => item.MACD), close.length); 
      case 'midprice':
        // Midprice = (high + low) / 2
        return padIndicator(high.map((h, i) => (h + low[i]) / 2), close.length);
      default:
        return [];
    }
  }

  function padIndicator(indicatorArr, totalLength) {
    return Array(totalLength - indicatorArr.length).fill(null).concat(indicatorArr);
  }

  function getSupportResistanceTraces() {
    const close = prices.close || [];
    const x = prices.x || [];
    if (close.length < supportResistancePeriod) return [];
    const recentCloses = close.slice(-supportResistancePeriod);
    const support = Math.min(...recentCloses);
    const resistance = Math.max(...recentCloses);
    return [
      {
        x: x,
        y: Array(x.length).fill(support),
        type: 'scatter',
        mode: 'lines',
        name: `Support (${support.toFixed(2)})`,
        line: { color: 'green', width: 1, dash: 'dot' },
        xaxis: 'x',
        yaxis: 'y1',
        showlegend: true
      },
      {
        x: x,
        y: Array(x.length).fill(resistance),
        type: 'scatter',
        mode: 'lines',
        name: `Resistance (${resistance.toFixed(2)})`,
        line: { color: 'red', width: 1, dash: 'dot' },
        xaxis: 'x',
        yaxis: 'y1',
        showlegend: true
      }
    ];
  }

  function getSupportResistanceBoxShapes() {
    const close = prices.close || [];
    const x = prices.x || [];
    if (close.length < supportResistancePeriod * 2) return [];
    const prevWindowStart = close.length - supportResistancePeriod * 2;
    const prevWindowEnd = close.length - supportResistancePeriod;
    const prevCloses = close.slice(prevWindowStart, prevWindowEnd);
    const support = Math.min(...prevCloses);
    const resistance = Math.max(...prevCloses);
    const supportMargin = (support * supportResistanceMarginPct) / 100;
    const resistanceMargin = (resistance * supportResistanceMarginPct) / 100;
    // Add vertical lines at the start and end of the support/resistance window
    const xStart = x[prevWindowStart];
    const xEnd = x[prevWindowEnd - 1];
    return [
      {
        type: 'rect',
        xref: 'paper',
        yref: 'y1',
        x0: 0,
        x1: 1,
        y0: support - supportMargin,
        y1: support + supportMargin,
        fillcolor: 'rgba(0,200,0,0.15)',
        line: { width: 0 },
        layer: 'below'
      },
      {
        type: 'rect',
        xref: 'paper',
        yref: 'y1',
        x0: 0,
        x1: 1,
        y0: resistance - resistanceMargin,
        y1: resistance + resistanceMargin,
        fillcolor: 'rgba(200,0,0,0.15)',
        line: { width: 0 },
        layer: 'below'
      },
      // Vertical line at start of support/resistance window
      xStart !== undefined ? {
        type: 'line',
        xref: 'x',
        yref: 'paper',
        x0: xStart,
        x1: xStart,
        y0: 0,
        y1: 1,
        line: { color: 'rgba(0,0,0,0.4)', width: 2, dash: 'dot' },
        layer: 'above'
      } : null,
      // Vertical line at end of support/resistance window
      xEnd !== undefined ? {
        type: 'line',
        xref: 'x',
        yref: 'paper',
        x0: xEnd,
        x1: xEnd,
        y0: 0,
        y1: 1,
        line: { color: 'rgba(0,0,0,0.4)', width: 2, dash: 'dot' },
        layer: 'above'
      } : null
    ].filter(Boolean);
  }

  function getPrevDayHighLowTraces() {
    const x = prices.x || [];
    if (!prevDayHigh || !prevDayLow || !x.length) return [];
    return [
      {
        x,
        y: Array(x.length).fill(prevDayHigh),
        type: 'scatter',
        mode: 'lines',
        name: 'Prev Day High',
        line: { color: 'purple', width: 1, dash: 'dash' },
        xaxis: 'x',
        yaxis: 'y1',
        showlegend: true
      },
      {
        x,
        y: Array(x.length).fill(prevDayLow),
        type: 'scatter',
        mode: 'lines',
        name: 'Prev Day Low',
        line: { color: 'brown', width: 1, dash: 'dash' },
        xaxis: 'x',
        yaxis: 'y1',
        showlegend: true
      }
    ];
  }

  function getHeikinAshiData() {
    const open = prices.open || [];
    const high = prices.high || [];
    const low = prices.low || [];
    const close = prices.close || [];
    if (!open.length) return { open, high, low, close };
    let haOpen = [ (open[0] + close[0]) / 2 ];
    let haClose = [];
    let haHigh = [];
    let haLow = [];
    for (let i = 0; i < close.length; i++) {
      haClose[i] = (open[i] + high[i] + low[i] + close[i]) / 4;
      if (i > 0) {
        haOpen[i] = (haOpen[i-1] + haClose[i-1]) / 2;
      }
      haHigh[i] = Math.max(high[i], haOpen[i], haClose[i]);
      haLow[i] = Math.min(low[i], haOpen[i], haClose[i]);
    }
    return { open: haOpen, high: haHigh, low: haLow, close: haClose };
  }

  function getRenkoData(brickSize = null) {
    const close = prices.close || [];
    const x = prices.x || [];
    if (!close.length) return { x: [], y: [], direction: [] };
    // Calculate brick size as ATR(renkoAtrPeriod) if not provided
    let size = brickSize;
    if (!size) {
      if (ATR_MODULE) {
        const atr = ATR_MODULE.calculate({ period: renkoAtrPeriod, high: prices.high, low: prices.low, close });
        size = atr[atr.length - 1] || 1;
      } else {
        size = 1;
      }
    }
    let bricks = [];
    let brickX = [];
    let direction = [];
    let lastBrick = close[0];
    let lastDir = 0;
    for (let i = 1; i < close.length; i++) {
      let diff = close[i] - lastBrick;
      if (Math.abs(diff) >= size) {
        let n = Math.floor(Math.abs(diff) / size);
        for (let j = 0; j < n; j++) {
          lastBrick = lastBrick + size * Math.sign(diff);
          bricks.push(lastBrick);
          brickX.push(x[i]);
          direction.push(Math.sign(diff));
          lastDir = Math.sign(diff);
        }
      }
    }
    return { x: brickX, y: bricks, direction };
  }

  function getRenkoBricksShapes() {
    if (!showRenkoOverlay) return [];
    const close = prices.close || [];
    const x = prices.x || [];
    if (!close.length) return [];
    // Use ATR(renkoAtrPeriod) as the brick size for overlay, matching getRenkoData default
    let size = 1;
    if (ATR_MODULE) {
      const atr = ATR_MODULE.calculate({ period: renkoAtrPeriod, high: prices.high, low: prices.low, close });
      size = atr[atr.length - 1] || 1;
    }
    let shapes = [];
    let lastBrick = close[0];
    let lastX = x[0];
    for (let i = 1; i < close.length; i++) {
      let diff = close[i] - lastBrick;
      if (Math.abs(diff) >= size) {
        let n = Math.floor(Math.abs(diff) / size);
        for (let j = 0; j < n; j++) {
          let newBrick = lastBrick + size * Math.sign(diff);
          shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'y1',
            x0: lastX,
            x1: x[i],
            y0: Math.min(lastBrick, newBrick),
            y1: Math.max(lastBrick, newBrick),
            fillcolor: Math.sign(diff) > 0 ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)',
            line: { width: 0 },
            layer: 'below'
          });
          lastBrick = newBrick;
          lastX = x[i];
        }
      }
    }
    return shapes;
  }

  function getTraces() {
    const traces = [];
    // Main plot (candlestick or heikinashi)
    let ohlc = prices;
    if (plotType === 'heikinashi') {
      ohlc = getHeikinAshiData();
    }
    traces.push({
      x: prices.x || [],
      open: ohlc.open || [],
      high: ohlc.high || [],
      low: ohlc.low || [],
      close: ohlc.close || [],
      type: 'candlestick',
      name: plotType === 'heikinashi' ? 'Heikin Ashi' : 'OHLC',
      xaxis: 'x',
      yaxis: 'y1',
      increasing: { line: { color: '#00695c', width: 1.5 }, fillcolor: '#26a69a' }, 
      decreasing: { line: { color: '#b71c1c', width: 1.5 }, fillcolor: '#ef5350' }, 
      showlegend: true
    });
    for (const ind of selectedIndicators) {
      let ohlc = prices;
      if (plotType === 'heikinashi') {
        ohlc = getHeikinAshiData();
      }
      const close = ohlc.close || [];
      const high = ohlc.high || [];
      const low = ohlc.low || [];
      if (ind === 'sma' && SMA_MODULE) {
        const smaData = SMA_MODULE.calculate({ period: selectedPeriod, values: close });
        const pad = close.length - smaData.length;
        const sma = Array(pad).fill(null).concat(smaData);
        traces.push({
          x: prices.x || [],
          y: sma,
          type: 'scatter',
          mode: 'lines',
          name: `SMA ${selectedPeriod}`,
          line: { color: 'rgba(255, 182, 182, 1)', width: 2 },
          xaxis: 'x',
          yaxis: 'y1'
        });
      }
      if (ind === 'ema' && EMA_MODULE) {
        const emaData = EMA_MODULE.calculate({ period: selectedPeriod, values: close });
        const pad = close.length - emaData.length;
        const ema = Array(pad).fill(null).concat(emaData);
        traces.push({
          x: prices.x || [],
          y: ema,
          type: 'scatter',
          mode: 'lines',
          name: `EMA ${selectedPeriod}`,
          line: { color: 'orange', width: 2 },
          xaxis: 'x',
          yaxis: 'y1'
        });
      }
      if (ind === 'atr' && ATR_MODULE) {
        const atrData = ATR_MODULE.calculate({ period: selectedPeriod, high, low, close });
        const pad = close.length - atrData.length;
        const atr = Array(pad).fill(null).concat(atrData);
        traces.push({
          x: prices.x || [],
          y: atr,
          type: 'scatter',
          mode: 'lines',
          name: `ATR ${selectedPeriod}`,
          line: { color: 'green', width: 2 },
          xaxis: 'x',
          yaxis: 'y2'
        });
      }
      if (ind === 'rsi' && RSI_MODULE) {
        const rsiData = RSI_MODULE.calculate({ period: selectedPeriod, values: close });
        const pad = close.length - rsiData.length;
        const rsi = Array(pad).fill(null).concat(rsiData);


        traces.push({
          x: prices.x || [],
          y: rsi,
          type: 'scatter',
          mode: 'lines',
          name: `RSI ${selectedPeriod}`,
          line: { color: 'red', width: 2 },
          xaxis: 'x',
          yaxis: 'y2'
        });
      }
      if (ind === 'macd' && MACD_MODULE) {
        const close = ohlc.close || [];
        const macdData = MACD_MODULE.calculate({
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
          values: close
        });
        const pad = close.length - macdData.length;
        const macd = Array(pad).fill(null).concat(macdData.map(d => d.MACD));
        const signal = Array(pad).fill(null).concat(macdData.map(d => d.signal));
        const histogram = Array(pad).fill(null).concat(macdData.map(d => d.histogram));
        traces.push({
          x: prices.x || [],
          y: macd,
          type: 'scatter',
          mode: 'lines',
          name: 'MACD',
          line: { color: 'blue', width: 2 },
          xaxis: 'x',
          yaxis: 'y2'
        });
        traces.push({
          x: prices.x || [],
          y: signal,
          type: 'scatter',
          mode: 'lines',
          name: 'MACD Signal',
          line: { color: 'orange', width: 2 },
          xaxis: 'x',
          yaxis: 'y2'
        });
        traces.push({
          x: prices.x || [],
          y: histogram,
          type: 'bar',
          name: 'MACD Histogram',
          marker: { color: 'purple' },
          xaxis: 'x',
          yaxis: 'y2'
        });
      }
      if (ind === 'midprice') {
        const mid = high.map((h, i) => (h + low[i]) / 2);
        traces.push({
          x: prices.x || [],
          y: mid,
          type: 'scatter',
          mode: 'lines',
          name: 'Midprice',
          line: { color: 'blue', width: 1 },
          xaxis: 'x',
          yaxis: 'y1'
        });
      }
    }
    // Add support/resistance lines
    traces.push(...getSupportResistanceTraces());
    if (showPrevDayHighLow) {
      traces.push(...getPrevDayHighLowTraces());
    }
    // Add Renko as a side-by-side plot if enabled
    if (showRenko) {
      const renko = getRenkoData();
      traces.push({
        x: renko.x,
        y: renko.y,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Renko',
        line: { color: 'black', width: 2, shape: 'hv' },
        marker: { color: renko.direction.map(d => d > 0 ? 'green' : 'red'), size: 8 },
        xaxis: 'x3',
        yaxis: 'y3',
        showlegend: true
      });
    }
    // Add Renko as overlay if enabled
    if (showRenkoOverlay) {
      const renko = getRenkoData();
      traces.push({
        x: renko.x,
        y: renko.y,
        type: 'scatter',
        mode: 'lines', // Only border line, no points
        name: 'Renko Overlay',
        line: { color: 'black', width: 2, shape: 'hv' },
        xaxis: 'x',
        yaxis: 'y1',
        showlegend: true,
        opacity: 0.7
      });
    }
    return traces;
  }
  function detectCandlePatrns(ohlc) {
    const Pattrns = [];
    const { open, high, low, close, x } = ohlc;
    if (!open || !close || !high || !low) return Pattrns;
    for (let i = 1; i < open.length; i++) {
      // Doji
      if (Math.abs(open[i] - close[i]) < (high[i] - low[i]) * 0.1) {
        Pattrns.push({ x: x[i], y: high[i], text: 'Doji' });
      }
      // Hammer
      if (
        (close[i] > open[i]) &&
        ((open[i] - low[i]) > 2 * Math.abs(close[i] - open[i])) &&
        ((high[i] - close[i]) < Math.abs(close[i] - open[i]))
      ) {
        Pattrns.push({ x: x[i], y: low[i], text: 'Hammer' });
      }
      // Bullish Engulfing
      if (
        (close[i] > open[i]) &&
        (close[i-1] < open[i-1]) &&
        (open[i] < close[i-1]) &&
        (close[i] > open[i-1])
      ) {
        Pattrns.push({ x: x[i], y: high[i], text: 'Bull Engulf' });
      }
      // Bearish Engulfing
      if (
        (close[i] < open[i]) &&
        (close[i-1] > open[i-1]) &&
        (open[i] > close[i-1]) &&
        (close[i] < open[i-1])
      ) {
        Pattrns.push({ x: x[i], y: low[i], text: 'Bear Engulf' });
      }
    }
    return Pattrns;
  }

  function updatePlot() {
    if (plotlyLoaded && plotDiv) {
      const traces = getTraces();
      traces.forEach(trace => {
        if (trace.yaxis === 'y2') {
          trace.xaxis = 'x2';
        }
      });
      const hasLowerPlot = selectedIndicators.some(ind => ['atr', 'rsi', 'macd'].includes(ind));
      const boxShapes = getSupportResistanceBoxShapes();
      const renkoShapes = getRenkoBricksShapes();
      let PattrnAnnots = [];
      if (showPattrnAnnotations) {
        const ohlc = (plotType === 'heikinashi') ? getHeikinAshiData() : prices;
        PattrnAnnots = detectCandlePatrns(ohlc).map(p => ({
          x: p.x,
          y: p.y,
          xref: 'x',
          yref: 'y1',
          text: p.text,
          showarrow: true,
          arrowhead: 7,
          ax: 0,
          ay: p.text === 'Hammer' ? 40 : -40,
          bgcolor: 'rgba(255,255,0,0.7)',
          bordercolor: 'black',
          font: { color: 'black', size: 10 }
        }));
      }
      let layout = {
        title: '',
        grid: { rows: 2, columns: 1, Pattrn: 'independent', roworder: 'top to bottom' },
        height: 800,
        margin: { t: 20, r: 50, l: 50, b: 90 },
        showlegend: true,
        xaxis: {
          title: '',
          type: 'category',
          tickangle: 45,
          tickfont: { size: 10 },
          automargin: true,
          matches: 'x2',
          anchor: 'y1',
          domain: [0, 1],
          showticklabels: !hasLowerPlot,
          rangeslider: { visible: false },
          rangeselector: undefined
        },
        yaxis: {
          title: 'Price (USD)',
          automargin: true,
          domain: hasLowerPlot ? [0.3333, 1] : [0.5, 1], 
          anchor: 'x'
        },
        xaxis2: {
          title: '',
          type: 'category',
          tickangle: 45,
          tickfont: { size: 10 },
          automargin: true,
          anchor: 'y2',
          domain: [0, 1],
          showticklabels: hasLowerPlot,
          rangeslider: { visible: false },
          rangeselector: undefined
        },
        yaxis2: {
          title: 'Indicators',
          automargin: true,
          domain: [0, 0.3333], // lower plot: 1/3 of height
          anchor: 'x2',
          showgrid: true
        },
        xaxis3: {
          title: '',
          type: 'category',
          tickangle: 45,
          tickfont: { size: 10 },
          automargin: true,
          anchor: 'y3',
          domain: [0, 1],
          showticklabels: true
        },
        yaxis3: {
          title: 'Renko',
          automargin: true,
          domain: [0, 0.3333],
          anchor: 'x3',
          showgrid: true
        },
        shapes: [...boxShapes, ...renkoShapes],
        annotations: PattrnAnnots,
        hovermode: 'x unified',
        spikedistance: -1,
        xaxis_showspikes: true,
        xaxis_spikemode: 'across',
        xaxis_spikesnap: 'cursor',
        xaxis_spikethickness: 1,
        xaxis_spikecolor: '#888',
        xaxis2_showspikes: true,
        xaxis2_spikemode: 'across',
        xaxis2_spikesnap: 'cursor',
        xaxis2_spikethickness: 1,
        xaxis2_spikecolor: '#888'
      };
      Plotly.react(plotDiv, traces, layout, {responsive: true});
    }
  }

  async function fetchAndUpdate() {
    await fetchCryptoData(selectedInstrument);
    await fetchPrevDayHighLow(selectedInstrument);
    updatePlot();
  }

  onMount(async () => {
    Plotly = (await import('plotly.js-dist-min')).default;
    plotlyLoaded = true;
    SMA_MODULE = await import('technicalindicators').then(m => m.SMA);
    EMA_MODULE = await import('technicalindicators').then(m => m.EMA);
    ATR_MODULE = await import('technicalindicators').then(m => m.ATR);
    RSI_MODULE = await import('technicalindicators').then(m => m.RSI);
    MACD_MODULE = await import('technicalindicators').then(m => m.MACD);
    updatePlot();
    fetchAndUpdate();
    const interval = setInterval(fetchAndUpdate, 50000);
    return () => clearInterval(interval);
  });

  function resetZoom() {
    if (plotlyLoaded && plotDiv) {
      Plotly.relayout(plotDiv, {
        'xaxis.autorange': true,
        'yaxis.autorange': true
      });
    }
  }

  // Reactively update plot when indicator or period changes
  $: if (plotlyLoaded && plotDiv) updatePlot();
  $: if (showPattrnAnnotations && plotType === 'heikinashi') {
    plotType = 'candlestick';
  }
</script>

<div style="margin:0 auto;width:80%;">
  <div style="margin-bottom: 1em;">
    <label for="instrument-select">Select Instrument: </label>
    <select
      id="instrument-select"
      bind:value={selectedInstrument}
      on:change={fetchAndUpdate}
      style="width: 100%;"
    >
      {#each instruments as instrument}
        <option value={instrument.value}>{instrument.label}</option>
      {/each}
    </select>
  </div>
  <div style="display: flex; flex-wrap: wrap; gap: 1em; margin-bottom: 1em; width: 100%;">
    <div style="display: flex; flex-direction: row; flex-wrap: wrap; width: 100%; gap: 1em;">
      <div style="flex: 1 1 20%; min-width: 180px; max-width: 25%; display: flex; flex-direction: column;">
        <label for="candles-select">Number of Candles: </label>
        <select
          id="candles-select"
          bind:value={selectedNumberOfCandles}
          on:change={fetchAndUpdate}
          style="width: 100%;"
        >
          {#each numberOfCandlesOptions as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </div>
      <div style="flex: 1 1 20%; min-width: 180px; max-width: 25%; display: flex; flex-direction: column;">
        <label for="indicator-select">Select Indicator: </label>
        <select
          id="indicator-select"
          bind:value={selectedIndicators}
          on:change={updatePlot}
          style="width: 100%;"
          multiple
        >
          {#each indicatorOptions as indicator}
            <option value={indicator.value}>{indicator.label}</option>
          {/each}
        </select>
      </div>
      <div style="flex: 1 1 20%; min-width: 180px; max-width: 25%; display: flex; flex-direction: column;">
        <label for="period-select">Select Period: </label>
        <select
          id="period-select"
          bind:value={selectedPeriod}
          on:change={updatePlot}
          style="width: 100%;"
        >
          {#each periodOptions as period}
            <option value={period}>{period}</option>
          {/each}
        </select>
      </div>
      <div style="flex: 1 1 20%; min-width: 180px; max-width: 25%; display: flex; flex-direction: column;">
        <label for="sr-period-select">Support/Resistance Period: </label>
        <select
          id="sr-period-select"
          bind:value={supportResistancePeriod}
          on:change={updatePlot}
          style="width: 100%;"
        >
          {#each [5, 10, 15, 20, 25, 30, 40, 50, 75, 100] as srOpt}
            <option value={srOpt}>{srOpt}</option>
          {/each}
        </select>
      </div>
      <div style="flex: 1 1 20%; min-width: 180px; max-width: 25%; display: flex; flex-direction: column;">
        <label for="renko-atr-period-select">Renko ATR Period: </label>
        <select
          id="renko-atr-period-select"
          bind:value={renkoAtrPeriod}
          on:change={updatePlot}
          style="width: 100%;"
        >
          {#each renkoAtrPeriodOptions as period}
            <option value={period}>{period}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>
  <div style="margin-bottom: 1em; display: flex; gap: 2em; align-items: center;">
    <label>Plot Type:</label>
    <label><input type="radio" name="plotType" value="candlestick" bind:group={plotType} on:change={updatePlot}> Candle</label>
    <label><input type="radio" name="plotType" value="heikinashi" bind:group={plotType} on:change={updatePlot}> Heikin Ashi</label>
    <label><input type="checkbox" bind:checked={showRenkoOverlay} on:change={updatePlot}> Show Renko Overlay</label>
    <label><input type="checkbox" bind:checked={showPrevDayHighLow} on:change={updatePlot}> Show Prev Day High/Low</label>
    <label><input type="checkbox" bind:checked={showPattrnAnnotations} on:change={updatePlot}> Candle Pattrn</label>
    {#if showPattrnAnnotations && plotType === 'heikinashi'}
      <span style="color: red; font-size: 0.9em;">Pattrn detection only works with Candle plot</span>
    {/if}
  </div>
  <div bind:this={plotDiv}></div>
  <div style="margin-top:1em;">
    <button on:click={resetZoom}>Reset Zoom</button>
  </div>
</div>



