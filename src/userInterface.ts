import { User } from "./main.js";
import { Account } from "./main.js";
import { TimeLineEntry } from "./main.js";

declare const Chart: any;

export class UserInterface {
    charts = new ChartRenderer();

    renderTimeLineTable(user: User, future: TimeLineEntry[]){
        const container = document.getElementById("timeline-table")!;
        container.innerHTML = `
            <table>
                <thead id="table-header"></thead>
                <tbody id="table-body"></tbody>
            </table>
        `;
        this.renderTableHeader(user.accounts);
        this.renderHistory(user);
        this.renderProjection(user, future);
    }
    renderTableHeader(accounts: Map<number,Account>){
        const headerHTML = document.getElementById("table-header")!;
        headerHTML.innerHTML = `
        <tr>
            <th class="col-date">Date</th>
            <th class="col-concept">Concept</th>
            ${Array.from(accounts.values())
                .map(account => `<th class="col-account">${account.name}</th>`)
                .join("")}
            <th class="col-net">Net Worth</th>
        </tr>`;
    }
    renderHistory(user: User){
        const tableBody = document.getElementById("table-body")!;
        this.renderRowSection("Actual History", user);
        let html = ``;
        for (const entry of user.history)
            html += this.renderTimeLineEntry(entry, user);
        tableBody.innerHTML += html;
    }
    renderProjection(user: User, future: TimeLineEntry[]){
        const tableBody = document.getElementById("table-body")!;
        this.renderRowSection("Projection", user);
        let html = ``;
        for (const entry of future)
            html += this.renderTimeLineEntry(entry, user);
        tableBody.innerHTML += html;
    }

    renderRowSection(title: string, user: User){
        const tableBody = document.getElementById("table-body")!;
        let html = `
        <tr class="section-row">
            <td colspan="${user.accounts.size + 3}">${title}</td>
        </tr>`;
        tableBody.innerHTML += html;
    }

    renderTimeLineEntry(entry: TimeLineEntry, user: User): string {
        return `
            <tr>
                <td>${entry.date.toLocaleDateString("en-GB", {day: "2-digit",month: "short",year: "2-digit"})}</td>
                <td>${this.printConcepts(entry.concepts)}</td>
                ${Array.from(user.accounts.values())
                    .map(account =>`<td>${this.formatCurrency(entry.balances.get(account.id) ?? 0)}</td>`).join("")}
                <td>${this.formatCurrency(entry.netWorth)}</td>
            </tr>
        `;
    }

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

class ChartRenderer {

    renderNetWorthChart(history: TimeLineEntry[], future: TimeLineEntry[]) {
        const canvas = document.getElementById("net-worth-chart") as HTMLCanvasElement;
        const data = this.getNetWorthChartData(history, future);
        const options = this.getNetWorthChartOptions();
        new Chart(canvas, {type: "line", data: data, options: options});
    }

    getNetWorthChartData(history: TimeLineEntry[], future: TimeLineEntry[]) {
        const historyLength = history.length;
        const actualTimeline = history;
        const projectedTimeline = [
            history[history.length - 1],
            ...future
        ];
        const timeline = [
            ...history,
            ...future
        ];
        console.log(projectedTimeline);
        return {
            labels: 
                timeline.map(entry => entry.date.toLocaleDateString( "en-GB", {day: "2-digit", month: "short", year: "2-digit"})),

             datasets: [
                {
                    label: "Actual",
                    data: [
                        ...actualTimeline.map(entry => entry.netWorth),
                        ...future.map(() => null)
                    ],

                    fill: true,
                    borderWidth: 0,
                    pointRadius: 0,
                    tension: 0.3,
                    backgroundColor: "rgba(54, 162, 235, 0.35)"
                },
                {
                    label: "Projected",
                    data: [
                        ...history.slice(0, -1).map(() => null),
                        ...projectedTimeline.map(entry => entry.netWorth)
                    ],
                    fill: true,
                    borderWidth: 0,
                    pointRadius: 0,
                    tension: 0.3,
                    backgroundColor: "rgba(54, 162, 235, 0.12)"
                }
            ]
        };
    }


    getNetWorthChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,

            scales: {
                x: {
                    grid: {
                        color: "rgba(249, 249, 249, 0.2)"
                    }
                },

                y: {
                    grid: {
                        color: "rgba(249, 249, 249, 0.2)"
                    }
                }
            }
        };
    }
}