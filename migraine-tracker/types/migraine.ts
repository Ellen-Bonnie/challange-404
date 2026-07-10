export type Severity = 0 | 1 | 2;

export interface DayEntry {

    date: string;

    severity: Severity;

    notes?: string;

    triggers: {
        sleep: boolean;
        stress: boolean;
        food: boolean;
        weather: boolean;
        hormones: boolean;
        other: string;
    };
}