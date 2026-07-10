import { MonthStats } from "../utils/analytics";

interface Props {
  stats: MonthStats[];
}

export default function AnalyticsSummary({ stats }: Props) {

  const best = [...stats].sort((a,b)=>a.total-b.total)[0];
  const worst = [...stats].sort((a,b)=>b.total-a.total)[0];

  const total = stats.reduce((s,m)=>s+m.total,0);

  return (

<div className="grid md:grid-cols-3 gap-5">

<Card
title="Best Month"
value={best.label}
/>

<Card
title="Worst Month"
value={worst.label}
/>

<Card
title="Total Symptoms"
value={total}
/>

</div>

  );

}

function Card({title,value}:{title:string,value:any}){

return(

<div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-sm p-6">

<div className="text-zinc-500">

{title}

</div>

<div className="text-3xl font-bold mt-3">

{value}

</div>

</div>

)

}