interface Props{

headaches:number;

migraines:number;

symptomFree:number;

affected:number;

}

export default function StatsCards({

headaches,

migraines,

symptomFree,

affected

}:Props){

const cards=[

{

title:"Headaches",

value:headaches,

color:"bg-yellow-100"

},

{

title:"Migraines",

value:migraines,

color:"bg-red-100"

},

{

title:"Symptom Free",

value:symptomFree,

color:"bg-green-100"

},

{

title:"Affected",

value:`${affected}%`,

color:"bg-blue-100"

}

];

return(

<div className="grid grid-cols-2 xl:grid-cols-4 gap-5">

{cards.map(card=>(

<div

key={card.title}

className={`rounded-2xl p-6 shadow-sm ${card.color}`}

>

<div className="text-sm opacity-60">

{card.title}

</div>

<div className="text-3xl font-bold mt-2">

{card.value}

</div>

</div>

))}

</div>

)

}