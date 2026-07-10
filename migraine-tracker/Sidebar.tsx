import {

Calendar,

Activity,

BarChart3,

Download,

Settings

} from "lucide-react";

const items=[

["Dashboard",Calendar],

["Analytics",BarChart3],

["Export",Download],

["Settings",Settings]

];

export default function Sidebar(){

return(

<aside className="w-64 bg-white dark:bg-zinc-900 shadow-sm hidden lg:flex flex-col">

<div className="text-2xl font-bold p-8">

🧠 Migraine

</div>

<nav className="px-4 space-y-2">

{items.map(([name,Icon])=>(

<button

key={name}

className="flex items-center gap-3 w-full rounded-xl px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"

>

<Icon size={18}/>

{name}

</button>

))}

</nav>

</aside>

)

}