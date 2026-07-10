export default function Header(){

return(

<header className="flex justify-between items-center">

<div>

<h1 className="text-3xl font-bold">

Migraine Tracker

</h1>

<p className="text-zinc-500">

Track symptoms in seconds.

</p>

</div>

<button

className="rounded-xl bg-black text-white dark:bg-white dark:text-black px-5 py-3"

>

Today

</button>

</header>

)

}