<script>
// @ts-nocheck

  import { onMount } from 'svelte';
  import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';
  Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);
  let prices = {};
  let chart;





  function calculateSMA(prices, period = 50) {
    if (!prices || prices.length < period) {
        return []; 
    }
    const smaValues = [];
    for (let i =0; i< period;i++) {
      smaValues.push(null)
    }
    for (let i =period- 1; i< prices.length; i++) {
        const windowSlice = prices.slice(i - period + 1, i + 1);
        const sum = windowSlice.reduce((prev, curr) => prev + curr, 0);
        smaValues.push(sum/period);
    }
    return smaValues;
}
  async function fetchCryptoData(pair) {
    try {      
	    const curr1 = Date.now();
      const candleDuration= 5* 60* 1000;
      const numberOfCandles= 100;
      const totalCandleTime= candleDuration* numberOfCandles;
      const fromDt= curr1- totalCandleTime;
      const to= Math.floor(curr1/ 1000);  
      const from= Math.floor(fromDt/ 1000);
      const url1=`https://public.coindcx.com/market_data/candlesticks?pair=${pair}&from=${from}&to=${to}&resolution=5&pcode=f`
      console.log('----',url1)
      const response = await fetch(url1);
      const dt= await response.json();
      let temp1={x:[],y:[]}
      for(let indx=0;indx<dt.data.length;indx++){
        temp1.x.push(new Date(dt.data[indx].time).toLocaleTimeString())
        temp1.y.push(dt.data[indx].close)
      }
      prices= temp1
      updateChart();
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }
  function updateChart() {
    if (chart) {
      chart.data.labels= Object.values(prices.x);
      chart.data.datasets[0].data= Object.values(prices.y);
      chart.data.datasets[1].data=calculateSMA(Object.values(prices.y))
      chart.update();
    }
  }
 const drawChart=()=>{
    const ctx = document.getElementById('cryptoChart').getContext('2d');
      chart = new Chart(ctx, {
        type: 'line', 
        data: {
          labels: [], 
          datasets: [{
            label: 'Cryptocurrency Prices',
            data: [], 
            borderColor: 'rgba(75, 182, 182, 1)',
            borderWidth: 2,
            fill: false,pointRadius:1.5
          },{
            label: 'Cryptocurrency',
            data: [], 
            borderColor: 'rgba(255, 182, 182, 1)',
            borderWidth: 2,pointRadius: 0,
            fill: false,
          }]
        },
        options: {
          scales: {
            x: {
              type: 'category', 
              title: {
                display: true
              }
            },
            y: {
              type: 'linear', 
              title: {
                display: true,
                text: 'Price (USD)'
              }
            }
          }
    }})
  }

  onMount(() => {
    drawChart()
    fetchCryptoData('B-XRP_USDT');
    const interval = setInterval(()=>{fetchCryptoData('B-XRP_USDT');updateChart()}, 50000); 
    return () => clearInterval(interval);
  });
</script>
<div style="margin:0 auto;width:80%;">
  <canvas id="cryptoChart" width="400" height="280"></canvas>
</div>



