import React from "react";
import { useState, useEffect } from "react";
import { SeamlessApiClient } from "@mondaydotcomorg/api";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import "monday-ui-react-core/dist/main.css";

// Usage of mondaySDK example, for more information visit here: https://developer.monday.com/apps/docs/introduction-to-the-sdk/
const monday = mondaySdk();
const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

class Quote {
  id = null;
  name = null;
  group = null;
  date = null;
  lines = [];
  subTotal = 0;
  escalatableTotal = 0;
  escalationPct = 0;
  escalationAmt = 0;
  grandTotal = 0;
  marginPct = 0;
  marginAmount = 0;
  quoteAmount = 0;
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.group = data.group.title;
    for (var col of data.column_values) {
      // console.log(col);
      if (col.column.title === 'Escalation') {
        this.escalationPct = parseFloat(col.text);
      } else if (col.column.title === 'Margin') {
        this.marginPct = parseFloat(col.text);
      } else if (col.column.title === 'Date'){
        this.date = col.text;
        if (isNaN(this.weight)) {
          this.weight = null;
        }
      } else if (col.column.title === 'ExcludeFromEscalation') {
        const colData = JSON.parse(col.value);
        this.isEscalatable = !colData.checked;
      }
    }

    if (data.subitems) {
      this.lines = data.subitems.map(d => new LineItem(d));
    }
    this.escalatableTotal = this.lines.reduce((t,l) => (t + (l.isEscalatable ? l.extendedCost : 0)),0);
    this.subTotal = this.lines.reduce((t,l) => (t + l.extendedCost),0);
    this.escalationAmt = this.escalatableTotal * (this.escalationPct / 100);
    this.grandTotal = this.subTotal + this.escalationAmt;
    this.quoteAmount = this.grandTotal / (1 - (this.marginPct / 100));
    this.marginAmount = this.quoteAmount - this.grandTotal;
  }


  formattedEscalatableTotal() {
    return formatter.format(this.escalatableTotal);
  }
  formattedEscalationAmount() {
    return formatter.format(this.escalationAmt);
  }
  formattedTotal() {
    return formatter.format(this.grandTotal);
  }
  formattedQuoteAmount() {
    return formatter.format(this.quoteAmount);
  }
  formattedMarginAmount() {
    return formatter.format(this.marginAmount);
  }
}

class LineItem {
  id = null;
  quantity = 0;
  name = null;
  cost = null;
  isEscalatable = false;
  weight = null;

  constructor(data) {
    // console.log(data);
    this.id = data.id;
    this.name = data.name;
    for (var col of data.column_values) {
      // console.log(col);
      if (col.column.title === 'Quantity') {
        this.quantity = parseFloat(col.text);
      } else if (col.column.title === 'Cost') {
        this.cost = parseFloat(col.text);
      } else if (col.column.title === 'Weight'){
        this.weight = parseFloat(col.text);
        if (isNaN(this.weight)) {
          this.weight = null;
        }
      } else if (col.column.title === 'ExcludeFromEscalation') {
        const colData = JSON.parse(col.value);
        this.isEscalatable = !colData.checked;
      }
    }

    this.extendedCost = this.quantity * this.cost;
  }

  formattedCost() {
    return formatter.format(this.cost);
  }

  formattedExtendedCost() {
    return formatter.format(this.extendedCost);
  }
  
}

const App = () => {
  // const [context, setContext] = useState();
  const [boardId,setBoardId] = useState();
  const [itemId,setItemId] = useState();
  const [data,setData] = useState();

  useEffect(() => {
    // Notice this method notifies the monday platform that user gains a first value in an app.
    // Read more about it here: https://developer.monday.com/apps/docs/mondayexecute#value-created-for-user/
    monday.execute("valueCreatedForUser");

    // TODO: set up event listeners, Here`s an example, read more here: https://developer.monday.com/apps/docs/mondaylisten/
    monday.listen("context", (res) => {
      // setContext(res.data);
      setBoardId(res.data.boardId);
      setItemId(res.data.itemId);
    });
  }, []);

  useEffect(() => {
    if (itemId) {
      const client = new SeamlessApiClient();

      const qVar = { 
        boardIds: [boardId],
        itemIds: [itemId] 
      };

      const getItems = `
        query($boardIds:[ID!], $itemIds:[ID!]) {
          boards(ids: $boardIds) {
            id
            name    
            items_page (query_params: {ids: $itemIds}) {
              items {
                group {
                  title
                }
                id
                name
                column_values {
                  column {
                    type
                    title
                    id
                    settings_str
                  }
                  value
                  text
                }
                subitems {
                  id
                  name
                  column_values {
                    column {
                      type
                      title
                      id
                      settings_str
                    }
                    value
                    text
                  }
                }
              }
            }
          }
        }
      `;
      //console.log(getItems);

      client.query(getItems, qVar)
        .then((r) => {
          setData(r.data);
          console.log(r.data);
        });
    }
  }, [boardId,itemId]);

  // const getColumn = (item,columnName) => {
  //   const col = item.column_values.find(c => c.column.title == columnName)
  //   return col.text
  // }

  return (
    <>
      <div>
        <div>Board: {boardId}</div>
        <div>Item: {itemId}</div>
        {data?.data?.boards?.[0]?.items_page?.items ? data.data.boards[0].items_page.items.map(item => {
          const q = new Quote(item);
          return (
          <table key={q.id}>
            <thead>
              <tr><td>Project:</td><td>{q.name}</td></tr>
              <tr class="lines">
                <td>Quantity</td>
                <td>Description</td>
                <td>Cost</td>
                <td>Extended</td>
                <td>Weight</td>
              </tr>
            </thead>
            <tbody>
              {q.lines ? q.lines.map(subItem => (
                <tr key={subItem.id} class="lines">
                  <td class="number">{subItem.quantity}</td>
                  <td>{subItem.name}</td>
                  <td class="number">{subItem.formattedCost()}</td>
                  <td class="number">{subItem.formattedExtendedCost()}</td>
                  <td class="number">{subItem.weight}</td>
                </tr>
              )) : null}
              <tr class="lines">
                <td class="number">{q.escalationPct}%</td>
                <td>Escalation</td>
                <td class="number">{q.formattedEscalatableTotal()}</td>
                <td class="number">{q.formattedEscalationAmount()}</td>
                <td class="number"></td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td></td>
                <td></td>
                <td class="number">Total</td>
                <td class="number">{q.formattedTotal()}</td>
              </tr>
              <tr>
                <td></td>
                <td></td>
                <td class="number">{q.marginPct}% Margin</td>
                <td class="number">{q.formattedMarginAmount()}</td>
              </tr>
              <tr>
                <td></td>
                <td></td>
                <td class="number">Quote</td>
                <td class="number">{q.formattedQuoteAmount()}</td>
              </tr>
            </tfoot>
          </table>
        );}) : null }
      </div>
    </>
  );
};

export default App;
