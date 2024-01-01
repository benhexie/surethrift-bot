require("dotenv").config({ path: `${__dirname}/../.env` });
const puppeteer = require("puppeteer");
const fs = require("fs");

class Bot {
  constructor() {
    this.username = process.env.USER;
    this.password = process.env.PASS;
  }

  setDates(from, to) {
    this.from = from;
    this.to = to;
  }

  async init() {
    console.log("Initializing...");
    this.browser = await puppeteer.launch({ headless: "new" });
    this.page = await this.browser.newPage();
    await this.page.goto("https://ihvn.surethrift.com/control/");
    await this.page.waitForSelector("#login_form");
    console.log("Logging in...");
    await this.page.type("#username", this.username);
    await this.page.type("#password", this.password);
    await this.page.click(`input[name='submit']`);
    await this.page.waitForNavigation();
    await this.page.goto("https://ihvn.surethrift.com/control/rec_savings");
  }

  async getAccounts() {
    console.log("Getting accounts...");
    await this.page.waitForSelector("table.records tr");
    this.accounts = await this.page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table.records tr"));
      return rows
        .filter((row) => {
          const columns = row.querySelectorAll("td");
          return columns.length >= 3 && columns[0].innerText.trim() !== "";
        })
        .map((row) => {
          const columns = row.querySelectorAll("td");
          return {
            sn: columns[0].innerText,
            name: columns[1].innerText,
            number: columns[2].innerText,
          };
        });
    });
  }

  async getTransactions(account) {
    try {
      console.log(`Parsing transactions for ${account.name} ...`);
      await this.page.waitForSelector("#acctno");
      await this.page.type("#acctno", account.number);
      await this.page.evaluate(() => {
        document.querySelector("#datepicker1").value =
          this.from || "2023-01-01";
        document.querySelector("#datepicker2").value = this.to || "2023-12-31";
        document.querySelector("#go2").click();
      });
      await this.page.waitForSelector("#loading", { hidden: true });
      await this.page.waitForFunction(() => {
        const table = document.querySelector("#txtHint table:last-child");
        return table || document.body.innerText.includes("No Records Found");
      });
      account.transactions = await this.page.evaluate(() => {
        const table = document.querySelector("#txtHint table:last-child");
        if (!table) return [];
        let rows = Array.from(table.querySelectorAll("tr"));
        const transactions = [];
        let tempTransaction = {};
        monthMap = {
          "01": "January",
          "02": "February",
          "03": "March",
          "04": "April",
          "05": "May",
          "06": "June",
          "07": "July",
          "08": "August",
          "09": "September",
          10: "October",
          11: "November",
          12: "December",
        };
        let tempMonth = "01";
        rows = rows.filter((row) => {
          const columns = row.querySelectorAll("td");
          return columns.length >= 5 && columns[0].innerText.trim() !== "";
        });
        rows.forEach((row, index) => {
          const columns = row.querySelectorAll("td");
          const date = columns[0].innerText;
          const amount = columns[4].innerText;
          const month = date.split("-")[1];

          if (month !== tempMonth) {
            tempMonth = month;
            tempTransaction.month &&
              transactions.push({
                month: monthMap[tempTransaction.month],
                amount: parseFloat(
                  tempTransaction.amount?.replace(/,/g, "") || 0
                ),
              });
            tempTransaction = {};
          }

          tempTransaction.month = month;
          tempTransaction.amount = amount;

          if (index === rows.length - 1) {
            transactions.push({
              month: monthMap[tempTransaction.month],
              amount: parseFloat(
                tempTransaction.amount?.replace(/,/g, "") || 0
              ),
            });
          }
        });

        return transactions;
      });
    } catch (error) {
      account.transactions = [];
    }
    await this.page.evaluate(() => {
      document.querySelector("#acctno").value = "";
    });
  }

  createCSV() {
    // const exists = fs.existsSync(`${__dirname}/../data/transactions.csv`);
    // if (exists) return;
    fs.writeFileSync(
      `${__dirname}/../data/transactions.csv`,
      "S/N,Account Number,Account Name,January,February,March,April,May,June,July,August,September,October,November,December,Total,Average"
    );
  }

  appendToCSV(account) {
    const transactions = account.transactions;
    const csv = fs.readFileSync(`${__dirname}/../data/transactions.csv`);
    const lines = csv.toString().split("\n");
    const sn = account.sn;
    const accountNumber = account.number;
    const accountName = account.name;
    const january = parseFloat(
      transactions.find((t) => t.month === "January")?.amount || 0
    );
    const february =
      transactions.find((t) => t.month === "February")?.amount || 0;
    const march = transactions.find((t) => t.month === "March")?.amount || 0;
    const april = transactions.find((t) => t.month === "April")?.amount || 0;
    const may = transactions.find((t) => t.month === "May")?.amount || 0;
    const june = transactions.find((t) => t.month === "June")?.amount || 0;
    const july = transactions.find((t) => t.month === "July")?.amount || 0;
    const august = transactions.find((t) => t.month === "August")?.amount || 0;
    const september =
      transactions.find((t) => t.month === "September")?.amount || 0;
    const october =
      transactions.find((t) => t.month === "October")?.amount || 0;
    const november =
      transactions.find((t) => t.month === "November")?.amount || 0;
    const december =
      transactions.find((t) => t.month === "December")?.amount || 0;

    const total =
      january +
      february +
      march +
      april +
      may +
      june +
      july +
      august +
      september +
      october +
      november +
      december;

    const line = `${sn},${accountNumber},${accountName},${january},${february},${march},${april},${may},${june},${july},${august},${september},${october},${november},${december},${total},${total/12}`;
    lines.push(line);
    fs.writeFileSync(`${__dirname}/../data/transactions.csv`, lines.join("\n"));
  }

  async run() {
    this.createCSV();
    await this.init();
    await this.getAccounts();
    for (const account of this.accounts) {
      await this.getTransactions(account);
      this.appendToCSV(account);
    }
    await this.browser.close();
  }
}

const bot = new Bot();
// bot.setDates("2023-01-01", "2023-12-31");
bot.setDates("2023-01-01", "2023-12-31");
bot.run();
