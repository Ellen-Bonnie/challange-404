import { useEffect, useMemo, useState } from "react";

import { DayEntry, Severity } from "../types/migraine";

import { loadEntries, saveEntries } from "../utils/storage";

export function useMigraineStore() {

    const [entries, setEntries] = useState<Record<string, DayEntry>>(loadEntries);

    useEffect(() => {

        saveEntries(entries);

    }, [entries]);

    function setSeverity(date: string, severity: Severity) {

        setEntries(prev => ({

            ...prev,

            [date]: {

                date,

                severity,

                notes: prev[date]?.notes ?? "",

                triggers: prev[date]?.triggers ?? {

                    sleep:false,

                    stress:false,

                    food:false,

                    weather:false,

                    hormones:false,

                    other:""

                }

            }

        }));

    }

    function updateNotes(date:string,notes:string){

        setEntries(prev=>({

            ...prev,

            [date]:{

                ...prev[date],

                date,

                severity:prev[date]?.severity ?? 0,

                notes

            }

        }))

    }

    const stats=useMemo(()=>{

        const values=Object.values(entries);

        const headaches=values.filter(x=>x.severity===1).length;

        const migraines=values.filter(x=>x.severity===2).length;

        const total=headaches+migraines;

        const year=new Date().getFullYear();

        const start=new Date(year,0,1);

        const today=new Date();

        const days=Math.floor((today.getTime()-start.getTime())/86400000)+1;

        return{

            headaches,

            migraines,

            symptomFree:days-total,

            affected:days?Math.round(total/days*100):0

        }

    },[entries])

    return{

        entries,

        setSeverity,

        updateNotes,

        stats

    }

}