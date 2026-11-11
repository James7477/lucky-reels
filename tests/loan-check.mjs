import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, "Casino inline script missing");
new vm.Script(source); // Syntax-check the entire existing casino logic.

for (const game of ["slots", "blackjack", "poker", "baccarat", "roulette"]) {
  assert.ok(html.includes('data-game="' + game + '"'), "Existing game missing: " + game);
}
assert.match(html, /href="skill-arcade\.html"/, "Skill Arcade link must remain");
assert.match(html, /id="loanBtn"/);
assert.match(html, /id="loanDialog"/);
assert.match(html, /id="loanStatus"/);
assert.doesNotMatch(html, /id="resetBtn"/, "Old free top-up control must not remain");
assert.match(source, /loanBalance:\s*state\.loanBalance/, "Loan balance must persist");
assert.match(source, /loanBalance:\s*Number\.isFinite\(saved\.loanBalance\)/, "Existing saves must load debt");
assert.match(source, /const LOAN_CAP = 10000/);
assert.match(source, /const LOAN_STEP = 2000/);
assert.match(source, /const LOAN_REPAY_RATE = 0\.25/);

const snippets = ["applyLoanRepayment", "borrowCredits", "repayCredits"].map(name => {
  const re = new RegExp("  const " + name + " = [\\s\\S]*?^  };", "m");
  const text = source.match(re)?.[0];
  assert.ok(text, name + " function missing");
  return text;
});
assert.equal((source.match(/state\.credits \+= applyLoanRepayment/g) || []).length, 5, "Every casino game must apply automatic loan repayment");
for (const stake of ["slots.staked", "bj.bet", "vp.bet", "bac.bet", "staked"]) {
  assert.ok(source.includes("applyLoanRepayment("), "Repayment helper missing");
}

function createBank(credits = 0) {
  const state = {credits,loanBalance:0};
  const sandbox = {
    state, LOAN_CAP:10000, LOAN_STEP:2000, LOAN_REPAY_RATE:0.25,
    updateHeader(){}, refreshAll(){}, fmt(n){return n.toLocaleString("en-US");},
    $(id){return {textContent:""};},
    sfx:{win(){},click(){}},
  };
  vm.createContext(sandbox);
  vm.runInContext(snippets.join("\n") + "\nglobalThis.bank = {applyLoanRepayment,borrowCredits,repayCredits};", sandbox);
  return {state, ...sandbox.bank};
}

{
 const b=createBank(0);
 assert.equal(b.borrowCredits(2000),true);
 assert.equal(b.state.loanBalance,2000);
 assert.equal(b.state.credits,2000);
 assert.equal(b.borrowCredits(4000),true);
 assert.equal(b.state.loanBalance,6000);
 assert.equal(b.borrowCredits(4000),true);
 assert.equal(b.state.loanBalance,10000);
 assert.equal(b.state.credits,10000);
 assert.equal(b.borrowCredits(2000),false, "Cannot exceed 10,000 owed");
 assert.equal(b.borrowCredits(1000),false, "Must borrow in 2,000 steps");
 assert.equal(b.borrowCredits(-2000),false, "Cannot borrow negative amount");
 assert.equal(b.repayCredits(2000),2000);
 assert.equal(b.state.loanBalance,8000);
 assert.equal(b.state.credits,8000);
 assert.equal(b.borrowCredits(2000),true, "Can reborrow after partial repayment");
 assert.equal(b.state.loanBalance,10000);
}

{
 const b=createBank(0);
 assert.equal(b.borrowCredits(2000),true);
 assert.equal(b.applyLoanRepayment(100,100),100, "Returned stake is not profit");
 assert.equal(b.state.loanBalance,2000);
 assert.equal(b.applyLoanRepayment(0,100),0, "Loss pays nothing");
 assert.equal(b.applyLoanRepayment(180,100),160, "25% of 80 profit = 20 repaid");
 assert.equal(b.state.loanBalance,1980);
 assert.equal(b.applyLoanRepayment(103,100),102, "25% of 3 rounded up = 1");
 assert.equal(b.state.loanBalance,1979);
 assert.equal(b.repayCredits(Infinity),1979);
 assert.equal(b.state.loanBalance,0);
 assert.equal(b.applyLoanRepayment(500,100),500, "No deductions after debt cleared");
}

console.log("Lucky Reels loan tests passed: 2,000 increments, 10,000 cap, repay/reborrow, no-interest, profit-only repayment, and all five games.");
