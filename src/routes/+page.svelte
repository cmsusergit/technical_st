<script>
	import {GoogleCharts} from 'google-charts';

	import { onMount } from "svelte";
	const url1='https://public.coindcx.com/market_data/candles/?pair=B-BTC_USDT&interval=5m'
	let dt
	const drawChart=()=>{	 var data = google.visualization.arrayToDataTable([
		  ['Mon', 20, 28, 38, 45],
		  ['Tue', 31, 38, 55, 66],
		  ['Wed', 50, 55, 77, 80],
		  ['Thu', 77, 77, 66, 50],
		  ['Fri', 68, 66, 22, 15]

		], true)
		const options = {
				  legend: 'none',
				  bar: { groupWidth: '100%' }, // Remove space between bars.
				  candlestick: {
					fallingColor: { strokeWidth: 0, fill: '#a52714' }, // red
					risingColor: { strokeWidth: 0, fill: '#0f8d57' }   // green
				  }
				};
		var chart = new GoogleCharts.api.visualization.CandlestickChart(document.getElementById('chart1'));
		chart.draw(data, options)
	}
	
	onMount(async()=>{
		const rr=await fetch(url1)
		const dt_1=await rr.json()










		dt=[]
		for(let indx=0;indx<dt_1.length;indx++){
			dt.push(dt_1[indx])
		}
		GoogleCharts.load(drawChart);
	})
</script>


<svelte:head>
	<title>DemoTest</title>	
	<meta name="description" content="Svelte demo app" />
</svelte:head>
<section>	
	<h1>Hello There</h1>
	{#if dt}
		<div id="chart1" style="width:100%;height:510px;"></div>
		{#each dt as record}
			<p>{JSON.stringify(record)}</p>
			
			<p>{new Date(record.time)}</p>	
		{/each}
	{/if}
</section>




