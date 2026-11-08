
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

export class Account{
    id: number = 0;
    name: string;
    interestRate: number = 0;
    type: AccountType = AccountType.Checking;
    active: boolean = true;
    constructor(name: string){
        this.name = name;
    }
}
class LiabilityAccount extends Account{
    minimum: number = 0;
    frequency: Frequency = 0;
    from: string | null = null;
    dueDate: Date | null = null;

    constructor(name: string){
        super(name);
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
           const account = accountData.type && this.isLiabilityAccount(accountData.type)
            ? new LiabilityAccount(accountData.name)
            : new Account(accountData.name);
            account.interestRate = accountData.interestRate ?? 0;
            account.type = this.parseAccountType(accountData.type ?? "Checking");
            account.active = accountData.active ?? true;
            if(account instanceof LiabilityAccount){
                account.minimum = accountData.minimum ?? 0;
                account.frequency = this.parseFrequency(accountData.frequency ?? "Monthly");
                account.from = accountData.from;
                if(accountData.dueDate) account.dueDate = this.parseDate(accountData.dueDate);
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
                newBalances.set(accountId, this.accounts.get(accountId)?.active ? entryData.balances[accountName] : 0);
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
            default: throw new Error(`Unknown type: ${type}`);
        }
    }
    isLiabilityAccount(type: string): boolean {
        switch (type) {
            case "CreditCard":
            case "LineOfCredit":
            case "Loan":
                return true;
        }
        return false;
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

enum Strategy { Avalance, Snowball, MinimumPayment }
class Projection{
    user: User;
    future: TimeLineEntry[] = [];
    strategy: Strategy = Strategy.MinimumPayment;
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
                    this.applyTransaction(transaction.from, transaction.to, transaction.amount, newBalances)
                    newConcept.push(transaction.concept);
                }
            }

            // Is there any Recurrent Transaction that should be applied today?
            for(let transaction of this.user.recurringTransactions){
                if(this.shouldApplyRecurringTransaction(transaction, newDate)){
                    this.applyTransaction(transaction.from, transaction.to, transaction.amount, newBalances)
                    newConcept.push(transaction.concept);
                }
            }

            // Is there any Liability Account payment that should be applied today?
            for(let account of this.user.accounts.values()){
                if(account instanceof LiabilityAccount){
                    if(this.shouldApplyLiabilityPayment(account, newDate)){

                        // Find current balance of the account
                        const accountId = this.user.getAccountIdByName(account.name);
                        const balance = newBalances.get(accountId)!;
                        if(balance >= 0) continue; // No payment needed if the balance is zero or positive
                        const amountOwed = Math.abs(balance);

                        // Calculate the payment amount based on the minimum payment and the amount owed
                        const payment = Math.min( account.minimum, amountOwed);

                        this.applyTransaction(account.from, account.name, payment, newBalances);
                        newConcept.push(account.name + " Payment");
                    }
                }
            }

            // Save the new day in the projection
            this.future.push(new TimeLineEntry(newDate, newConcept, newBalances));
        }
        this.future.shift();
    }


    applyTransaction( from: string | null, to: string | null, amount: number, balances: Map<number, number> ) {
    // Check if either account is inactive
    if (from && !this.user.accounts.get(this.user.getAccountIdByName(from))?.active)
        return;

    if (to && !this.user.accounts.get(this.user.getAccountIdByName(to))?.active)
        return;

    // Apply transaction
    if (from) {
        const id = this.user.getAccountIdByName(from);
        const balance = balances.get(id) ?? 0;
        balances.set(id, balance - amount);
    }

    if (to) {
        const id = this.user.getAccountIdByName(to);
        const balance = balances.get(id) ?? 0;
        balances.set(id, balance + amount);
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
    shouldApplyLiabilityPayment(account: LiabilityAccount, currentDate: Date): boolean {
        if (!account.from || !account.dueDate) return false;
        if (currentDate < account.dueDate) return false;

        const daysSinceDue = Math.floor((currentDate.getTime() - account.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        switch (account.frequency) {
            case Frequency.Daily:
                return true;
            case Frequency.Weekly:
                return daysSinceDue % 7 === 0;
            case Frequency.Biweekly:
                return daysSinceDue % 14 === 0;
            case Frequency.Monthly:
                return currentDate.getDate() === account.dueDate.getDate();
            case Frequency.Yearly:
                return currentDate.getDate() === account.dueDate.getDate() && currentDate.getMonth() === account.dueDate.getMonth();
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
    projection.create((365/12)*12);

    let ui = new UserInterface();
    ui.charts.renderNetWorthChart(user.history,projection.future);

    ui.renderTimeLineTable(user, projection.future);

    console.log(user);   
}

main();


