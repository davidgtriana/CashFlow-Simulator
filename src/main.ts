let currency = "CAD";


class UserInterface {
    constructor(){}
    renderTimeLineTable(user: User){
        const container = document.getElementById("timeline-table")!;
        container.innerHTML = `
            <table>
                <thead id="table-header"></thead>
                <tbody id="table-body"></tbody>
            </table>
        `;
        this.renderTableHeader(user.accounts);
        this.renderHistory(user);
        //this.renderProjection();
    }

    renderTableHeader(accounts: Map<number,Account>){
        const headerHTML = document.getElementById("table-header")!;
        headerHTML.innerHTML = `
        <tr>
            <th id="col-date">Date</th>
            <th id="col-concept">Concept</th>
            ${Array.from(accounts.values())
                .map(account => `<th id="col-account">${account.name}</th>`)
                .join("")}
            <th id="col-net">Net Worth</th>
        </tr>`;
    }
    renderHistory(user: User){
        const tableBody = document.getElementById("table-body")!;
        let html = `
        <tr class="section-row">
            <td colspan="${user.accounts.size + 3}">Actual History</td>
        </tr>`;
        for (const entry of user.history) {
            html += `
                <tr>
                    <td>${entry.date.toLocaleDateString("en-GB", {day: "2-digit",month: "short",year: "2-digit"})}</td>
                    <td>${this.printConcepts(entry.concepts)}</td>

                    ${Array.from(user.accounts.values())
                        .map(account =>
                            `<td>${this.formatCurrency(
                                entry.balances.get(account.id) ?? 0
                            )}</td>`
                        )
                        .join("")}

                    <td>${this.formatCurrency(entry.netWorth)}</td>
                </tr>
            `;
        }
    tableBody.innerHTML += html;
    }
/*
    renderProjection(projection : Projection){
        const container = document.getElementById("projection-table")!;
        if (projection.days.length === 0){
            container.innerHTML = "No projected days yet.";
            return;
        }
        
        const rowsHTML = projection.days.map(day => {
        return `
            <tr>
                <td>${day.date.toLocaleDateString("en-GB", {day: "2-digit",month: "short",year: "2-digit"})}</td>
                <td class="concept-cell">${this.printConcepts(day.concepts)}</td>
                ${Array.from(projection.user.accounts.values())
                    .map(account =>`<td> ${this.formatCurrency(day.balances.get(account.id) ?? 0)} </td>`)
                    .join("")}
                <td>${this.formatCurrency(day.netWorth)}</td>
            </tr>
        `;
        }).join("");

  
    }*/
    formatCurrency(value: number): string {
        return value.toLocaleString("en-CA", {style: "currency", currency: "CAD"});
    }

    printConcepts(concepts: string[]): string{
        if (concepts.length > 1){
            return `
                <div class="concept-menu">
                    <span class="concept-label">
                        ${concepts.length} Transactions
                    </span>

                    <div class="concept-dropdown">
                        ${concepts
                            .map(concept => `<div>${concept}</div>`)
                            .join("")}
                    </div>
                </div>
            `;
        } else if (concepts.length === 1){
            return concepts[0];
        } else {
            return `<span class="no-transaction">No Transaction</span>`;
        }   
    }
    
}

class Account{
    id: number = 0;
    name: string;
    interestRate: number = 0;
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

class User{
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
            account.interestRate = accountData.interestRate;
            this.addAccount(account);
        }
    }
    async loadHistory(){
        const response = await fetch("history.json");
        const data = await response.json();
        for(const entryData of data.history){
            const [year, month, day] = entryData.date.split("-").map(Number);
            let newDate = new Date(year, month - 1, day);
            newDate.setHours(0, 0, 0, 0);
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
}

class TimeLineEntry{
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
        currentDate.setHours(0, 0, 0, 0);
        transaction.effectiveDate?.setHours(0, 0, 0, 0);
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

    let ui = new UserInterface();
    ui.renderTimeLineTable(user);
    

    // Setting up One Time transactions
    let oneTimeTransaction = new OneTimeTransaction("Car Down Payment");
    oneTimeTransaction.amount = 1000;
    oneTimeTransaction.from = "WS Checking";
    oneTimeTransaction.effectiveDate = new Date(2026, 11, 12);
    user.addOneTimeTransaction(oneTimeTransaction);

    // Setting up recurring transactions
    let recurring = new RecurringTransaction("Casino Salary");
    recurring.amount = 1200;
    recurring.frequency = Frequency.Biweekly;
    recurring.startDate = new Date(2026, 7, 6);
    recurring.to = "WS Checking";
    user.addRecurringTransaction(recurring);

    recurring = new RecurringTransaction("Casino Tips");
    recurring.amount = 400;
    recurring.frequency = Frequency.Weekly;
    recurring.startDate = new Date(2026, 7, 11);
    recurring.to = "WS Checking";
    user.addRecurringTransaction(recurring);

    recurring = new RecurringTransaction("TFSA Contribution");
    recurring.amount = 1350;
    recurring.frequency = Frequency.Monthly;
    recurring.from = "WS Checking";
    recurring.to = "TFSA";
    recurring.startDate = new Date(2026, 8, 2);
    recurring.active = true;
    user.addRecurringTransaction(recurring);

    recurring = new RecurringTransaction("Rent");
    recurring.amount = 750;
    recurring.frequency = Frequency.Monthly;
    recurring.from = "WS Checking";
    recurring.startDate = new Date(2026, 7, 28);
    user.addRecurringTransaction(recurring);

    recurring = new RecurringTransaction("Grandmother Debt");
    recurring.amount = 400;
    recurring.frequency = Frequency.Monthly;
    recurring.from = "WS Checking";
    recurring.startDate = new Date(2026, 7, 20);
    user.addRecurringTransaction(recurring);

    recurring = new RecurringTransaction("Allowance");
    recurring.amount = 300;
    recurring.frequency = Frequency.Biweekly;
    recurring.from = "WS Checking";
    recurring.startDate = new Date(2026, 7, 30);
    user.addRecurringTransaction(recurring);

    
    //let projection = new Projection(user);
    //projection.create(365*5);
    //ui.renderProjection(projection);
    

}

main();


