
import { UserInterface } from "./userInterface.js";

let currency = "CAD";

/***
 * ideas:
 *  - Support accounts with different and updated currencies
 *  - Make the projection follow the ideal process of pay debts, then emergency fund then investment
 *  - Transactions: Add, Edit, Remove
 *  - Accounts: Add, Edit, Remove
 *  - Users: Add, Edit, Remove
 *  - Edit JSON files to save info
 *  - Export as an Excel file
 *  */ 

enum AccountType {
    Cash,
    Checking,
    Savings,
    Investment,
    CreditCard,
    LineOfCredit,
    Loan
}
enum AccountCategory{ Asset, Liability}
export class Account{
    id: number = 0;
    name: string;
    interestRate: number = 0;
    type: AccountType = AccountType.Checking;
    category: AccountCategory = AccountCategory.Asset;
    constructor(name: string){
        this.name = name;
    }
}

class Transaction {
    concept: string;
    amount: number;
    from: string | null = null;
    to: string | null = null;
    active: boolean = true;
    constructor(concept: string, amount: number){
        this.concept = concept;
        this.amount = amount;
    }
}

class OneTimeTransaction extends Transaction{
    effectiveDate: Date | null = null;
    constructor(concept: string | null = null){
        super(concept ?? "No Concept", 0);
    }
}

enum Frequency { Yearly, Monthly, Biweekly, Weekly, Daily }
class RecurringTransaction extends Transaction{
    frequency: Frequency = 0;
    startDate: Date | null = null;
    endDate: Date | null = null;
    constructor(concept: string | null = null){
        super(concept ?? "No Concept", 0);
    }
}

export class User{
    name: string;
    accounts: Map<number, Account> = new Map();
    history: TimeLineEntry[] = [];
    recurringTransactions: RecurringTransaction[] = [];
    oneTimeTransactions: OneTimeTransaction[] = [];
    constructor(name: string){
        this.name = name;
    }
    addAccount(account: Account){
        account.id = this.accounts.size + 1;
        this.accounts.set(account.id, account);
    }
    getAccountIdByName(name: string): number{
        for(let [id, account] of this.accounts){
            if(account.name === name) return id;
        }
        throw new Error(`Account with name "${name}" not found.`);
    }

    addOneTimeTransaction(transaction: OneTimeTransaction){
        if(!transaction.to && !transaction.from) 
            throw new Error("Transaction '" + transaction.concept + "' must have either a 'to' or 'from' account specified.");
        this.oneTimeTransactions.push(transaction);
    }

    addRecurringTransaction(transaction: RecurringTransaction){
        if(!transaction.to && !transaction.from) 
            throw new Error("Transaction '" + transaction.concept + "' must have either a 'to' or 'from' account specified.");
        this.recurringTransactions.push(transaction);
    }

    async loadAccounts(){
        const response = await fetch("accounts.json");
        const data = await response.json();
        for(const accountData of data.accounts){
            let account = new Account(accountData.name);
            account.interestRate = accountData.interestRate ?? 0;
            if(accountData.type){
                account.type = this.parseAccountType(accountData.type);
                account.category = this.getAccountCategory(account.type);
            }
            this.addAccount(account);
        }
    }
    async loadHistory(){
        const response = await fetch("history.json");
        const data = await response.json();
        for(const entryData of data.history){
            let newDate = this.parseDate(entryData.date);
            let newConcepts = entryData.concepts;
            let newBalances = new Map<number, number>();
            for (const accountName in entryData.balances) {
                const accountId = this.getAccountIdByName(accountName);
                newBalances.set(accountId,entryData.balances[accountName]);
            }
            this.history.push(new TimeLineEntry(newDate, newConcepts, newBalances));
        }
        this.history.sort((a, b) => {return a.date.getTime() - b.date.getTime();});
    }
    async loadTransactions(){
        try { const response = await fetch("transactions.json");
            if (!response.ok) throw new Error(`transactions.json not found (${response.status})`);
            const data = await response.json();
            
            
            for (const oneTimeData of data.oneTimeTransactions){
                let oneTimeTransaction = new OneTimeTransaction(oneTimeData.concept);
                oneTimeTransaction.amount = oneTimeData.amount ?? 0;
                oneTimeTransaction.from = oneTimeData.from;
                oneTimeTransaction.to = oneTimeData.to;
                oneTimeTransaction.effectiveDate = this.parseDate(oneTimeData.effectiveDate);
                oneTimeTransaction.active = oneTimeData.active ?? true;
                this.addOneTimeTransaction(oneTimeTransaction);
            }
            
            
            for (const recurringData of data.recurringTransactions){
                let recurring = new RecurringTransaction(recurringData.concept);
                recurring.amount = recurringData.amount ?? 0;
                recurring.frequency = this.parseFrequency(recurringData.frequency);
                recurring.from = recurringData.from;
                recurring.to = recurringData.to;
                recurring.startDate = this.parseDate(recurringData.startDate);
                if(recurringData.endDate) recurring.endDate = this.parseDate(recurringData.endDate);
                recurring.active = recurringData.active ?? true;
                this.addRecurringTransaction(recurring);
            }
        } catch (error) {console.error(error);}
    }
    parseDate(dateString: string): Date {
        const [year, month, day] = dateString.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        date.setHours(0, 0, 0, 0);
        return date;
    }
    parseFrequency(frequency: string): Frequency {
        switch (frequency) {
            case "Daily": return Frequency.Daily;
            case "Weekly": return Frequency.Weekly;
            case "Biweekly": return Frequency.Biweekly;
            case "Monthly": return Frequency.Monthly;
            case "Yearly": return Frequency.Yearly;
            default: throw new Error(`Unknown frequency: ${frequency}`);
        }
    }
    parseAccountType(type: string): AccountType {
        switch (type) {
            case "Checking": return AccountType.Checking;
            case "Savings": return AccountType.Savings;
            case "Investment": return AccountType.Investment;
            case "CreditCard": return AccountType.CreditCard;
            case "LineOfCredit": return AccountType.LineOfCredit;
            case "Loan": return AccountType.Loan;
            default: throw new Error(`Unknown frequency: ${type}`);
        }
    }
    getAccountCategory(type: AccountType): AccountCategory {
        switch (type) {
            case AccountType.CreditCard: 
            case AccountType.LineOfCredit:
            case AccountType.Loan:
                return AccountCategory.Liability;
            default: return AccountCategory.Asset;
        }
    }
}

export class TimeLineEntry{
    date: Date;
    concepts: string[] = [];
    balances: Map<number, number>; // ID of the Account : Balance
    netWorth: number = 0;
    constructor(date: Date, concepts: string[], balances: Map<number, number>){
        this.date = date;
        this.concepts = concepts;
        this.balances = balances;
        this.balances.forEach((value, key) => {
            this.netWorth += value;
        });
    }
}

class Projection{
    user: User;
    future: TimeLineEntry[] = [];
    constructor(user: User){
        this.user = user;
    }

    create(daysToProject: number){    
        if (this.user.history.length === 0) 
            throw new Error("Cannot create projection without historical data.");                                                                                                                                                                                                                                                                                                                                                                                                                                   
        this.future.push(this.user.history[this.user.history.length - 1]);
        for(let i = 0; i < daysToProject; i++){
            // Get the last day in the projection
            let previousDay = this.future[this.future.length-1];

            // Create a new day based on the previous day
            let newDate = new Date (previousDay.date);
            newDate.setDate(previousDay.date.getDate() + 1);
            let newConcept: string[] = [];
            let newBalances = new Map(previousDay.balances);

            // Update Balance Interest Rate
            for (let [id, balance] of newBalances) {
                let account = this.user.accounts.get(id)!;
                if (account.interestRate === 0) continue;
                let dailyRate = account.interestRate / 365;
                newBalances.set(id, balance * (1 + dailyRate));
            }

            // Is there any One Time Transaction that should be applied today?
            for(let transaction of this.user.oneTimeTransactions){
                if(this.shouldApplyOneTimeTransaction(transaction, newDate)){
                    this.applyTransaction(transaction, newBalances)
                    newConcept.push(transaction.concept);
                }
            }

            // Is there any Recurrent Transaction that should be applied today?
            for(let transaction of this.user.recurringTransactions){
                if(this.shouldApplyRecurringTransaction(transaction, newDate)){
                    this.applyTransaction(transaction, newBalances)
                    newConcept.push(transaction.concept);
                }
            }
    
            // Save the new day in the projection
            this.future.push(new TimeLineEntry(newDate, newConcept, newBalances));
        }
        this.future.shift();
    }


    applyTransaction(transaction: Transaction, balances: Map<number, number>){

        if (transaction.from) {
            const id = this.user.getAccountIdByName(transaction.from);
            const balance = balances.get(id)!;
            balances.set(id,balance - transaction.amount);
        }

        if (transaction.to) {
            const id = this.user.getAccountIdByName(transaction.to);
            const balance = balances.get(id)!;
            balances.set(id,balance + transaction.amount);
        }

    }

    shouldApplyOneTimeTransaction(transaction: OneTimeTransaction, currentDate: Date): boolean {
        if (!transaction.active) return false;
        return currentDate.getTime() === transaction.effectiveDate?.getTime();
    }

    shouldApplyRecurringTransaction(transaction: RecurringTransaction, currentDate: Date): boolean {
        if (!transaction.active) return false;
        if (transaction.startDate === null) return false;
        if (currentDate < transaction.startDate) return false;
        if (transaction.endDate && currentDate > transaction.endDate) return false;

        const daysSinceStart = Math.floor((currentDate.getTime() - transaction.startDate.getTime()) / (1000 * 60 * 60 * 24));
        switch (transaction.frequency) {
            case Frequency.Daily:
                return true;
            case Frequency.Weekly:
                return daysSinceStart % 7 === 0;
            case Frequency.Biweekly:
                return daysSinceStart % 14 === 0;
            case Frequency.Monthly:
                return currentDate.getDate() === transaction.startDate.getDate();
            case Frequency.Yearly:
                return currentDate.getDate() === transaction.startDate.getDate() && currentDate.getMonth() === transaction.startDate.getMonth();
            default:
            return false;
        }   
    }
}


async function main(){
    let user = new User("user");
    await user.loadAccounts();
    await user.loadHistory();
    await user.loadTransactions();
    
    let projection = new Projection(user);
    projection.create((365/12)*4);

    let ui = new UserInterface();
    ui.charts.renderNetWorthChart(user.history,projection.future);

    ui.renderTimeLineTable(user, projection.future);
}

main();


