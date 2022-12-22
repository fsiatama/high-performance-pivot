# Pivot Table

This utility can help you to make a grouped values that aggregates the individual items of a more extensive data rows

## Usage/Examples

the initial data should be an array of simple javascript objects, example:

```javascript
[{
  "id": 1,
  "month": "2022-01",
  "amount": 49486509.42,
  "state": "New York",
  "contractorName": "Stroman, Johnston and Olson",
  "category": "Termite Control",
  "subcategory": "Fire Protection",
  "amountBudget": 14079681.46,
  "amountProjected": 34553480.33,
  "categoryId": 1,
  "type": "PP",
  "subcategoryId": 1
}, {
  "id": 2,
  "month": "2022-08",
  "amount": 42859712.41,
  "state": "West Virginia",
  "contractorName": "Pollich, Beer and Barrows",
  "category": "Ornamental Railings",
  "subcategory": "Prefabricated Aluminum Metal Canopies",
  "amountBudget": 23466077.24,
  "amountProjected": 47644000.07,
  "categoryId": 2,
  "type": "PP",
  "subcategoryId": 2
}, {
  "id": 3,
  "month": "2022-08",
  "amount": 46436462.76,
  "state": "Washington",
  "contractorName": "Lakin, Crooks and Schaefer",
  "category": "Termite Control",
  "subcategory": "HVAC",
  "amountBudget": 11653024.91,
  "amountProjected": 9579976.0,
  "categoryId": 3,
  "type": "PC",
  "subcategoryId": 3
}, {
  "id": 4,
  "month": "2022-05",
  "amount": 15191007.63,
  "state": "North Carolina",
  "contractorName": "Hudson, Hane and Yost",
  "category": "Fire Protection",
  "subcategory": "HVAC",
  "amountBudget": 24670269.17,
  "amountProjected": 26194960.95,
  "categoryId": 4,
  "type": "PX",
  "subcategoryId": 4
}, {
  .
  .
  .
}, {
  "id": 89,
  "month": "2022-08",
  "amount": 43838293.56,
  "state": "Michigan",
  "contractTitle": "O'Hara, Schinner and Schumm",
  "category": "Framing (Wood)",
  "subcategory": "Structural & Misc Steel Erection",
  "amountBudget": 7541735.38,
  "amountProjected": 30644879.95,
  "categoryId": 89,
  "type": "PP",
  "subcategoryId": 89
}]

```

### Example 1:

this configuration get a only one row with sum of key "amount" by each value in the key "month"

```javascript
import pivotTable, { IPivotConf } from '../../../lib/utils/PivotTable';

class ContractPaymentsController {
  async getTotalContractsByMonth(data: ContractFlow[]) {
    const pivotConf: IPivotConf = {
      pivotColumn: {
        caseColumn: 'month',
        sumColumn: 'amount',
      },
      aggregation: ['amount'],
    };

    const totalDataByMonth: ValueByMonth[] = await pivotTable.getPivotData(
      data,
      pivotConf,
    );

    return totalDataByMonth[0];
  }
}
```

output:

```javascript
[{
  '2022-01': -4591241.8,
  '2022-02': -7236781.8,
  '2022-03': -19580180.688,
  '2022-04': -104515830.732,
  '2022-05': -111858174.00472726,
  '2022-06': -176383207.92209452,
  '2022-07': -351707894.4675491,
  '2022-08': -373034523.45456207,
  '2022-08': -436153957.37192935,
  .
  .
  .
  "amount": 4134699926.333931
}]
```

### Example 2:

this example mix three configurations to get a grouped data by categories, similar to cash flow or contracts flow:

```javascript

async getContractsFlow (data: ContractFlow[]) {
  let pivotConf = {
      pivotColumn: {
        caseColumn: 'month',
        sumColumn: 'amount',
      },
      aggregation: ['amount', 'amountBudget', 'amountProjected'],
      groupBy: ['null AS parentId', '"categoryId_" || CAST(categoryId as INT) AS id', 'category AS name'],
    };

    const categoryData = await pivotTable.getPivotData(data, pivotConf);

    pivotConf = {
      pivotColumn: {
        caseColumn: 'month',
        sumColumn: 'amount',
      },
      aggregation: ['amount', 'amountBudget', 'amountProjected'],
      groupBy: [
        '"categoryId_" || CAST(categoryId as INT) AS parentId',
        '"subcategoryId_" || CAST(subcategoryId as INT) AS id',
        'subcategory AS name',
      ],
    };

    const subcategoryData = await pivotTable.getPivotData(data, pivotConf);

    pivotConf = {
      pivotColumn: {
        caseColumn: 'month',
        sumColumn: 'amount',
      },
      aggregation: ['amount', 'amountBudget', 'amountProjected'],
      groupBy: [
        '"subcategoryId_" || CAST(subcategoryId as INT) AS parentId',
        '"contractId_" || CAST(id as INT) AS id',
        'contractTitle AS name',
      ],
    };

    const contractData = await pivotTable.getPivotData(data, pivotConf);

    return [...categoryData, ...subcategoryData, ...contractData];
}

```

output:

```javascript
[{
  "parentId": null,
  "id": "categoryId_508",
  "name": "Diseños",
  "feb. 2020": 0,
  "mar. 2020": 0,
  "may. 2020": 0,
  "jun. 2020": 0,
  "jul. 2020": 0,
  "ago. 2020": 3010834,
  .
  .
  .
  "amount": 242509486.02,
  "amountBudget": 242509486.02,
  "amountProjected": 0
}, {
  "parentId": "categoryId_525",
  "id": "subcategoryId_657",
  "name": "Todo Riesgo en Construcción",
  "feb. 2020": 0,
  "mar. 2020": 0,
  "may. 2020": 0,
  "jun. 2020": 0,
  "jul. 2020": 0,
  "ago. 2020": 0,
  .
  .
  .
  "amount": 22586081,
  "amountBudget": 22586081,
  "amountProjected": 0
}, {
  .
  .
  .
}, {
  "parentId": "subcategoryId_923",
  "id": "contractId_190",
  "name": "VENTASDÉ",
  "feb. 2020": 0,
  "mar. 2020": 0,
  "may. 2020": 0,
  "jun. 2020": 3810734,
  "jul. 2020": 0,
  "ago. 2020": 4666462,
  "sep. 2020": 2481545,
  "oct. 2020": 2481545,
  "nov. 2020": 2481545,
  .
  .
  .
  "amount": 25059415,
  "amountInvoiced": 25059415,
  "amountProjected": 0
}]
```

### Example 3:

this example shows how you can agrupate values by custom identifier and shows them as a columns

```javascript
async getResumeByContract(data: ContractFlow[]) {

  const pivotConf = {
    pivotColumn: {
      caseColumn: 'type',
      sumColumn: 'amountBudget',
      values: {
        quota: ['PC', 'PP'],
        extra: ['PX'],
      },
    },
    aggregation: ['amount', 'amountProjected', 'amountBudget'],
    groupBy: ['month', 'state'],
    sortBy: ['origDate'],
  };

  return pivotTable.getPivotData(scheduleData, pivotConf);

}
```

output:

```javascript
[
  {
    month: 'mar. 2022',
    state: 'INVOICED',
    quota: 0,
    extra: 3243438,
    amount: 3243438,
    amountInvoiced: 3243438,
    amountProjected: 0,
    amountBudget: 3243438,
  },
  {
    month: 'abr. 2022',
    state: 'INVOICED',
    quota: 0,
    extra: 0,
    amount: 0,
    amountInvoiced: 0,
    amountProjected: 0,
    amountBudget: 0,
  },
  {
    month: 'may. 2022',
    state: 'INVOICED',
    quota: 0,
    extra: 0,
    amount: 0,
    amountInvoiced: 0,
    amountProjected: 0,
    amountBudget: 0,
  },
  {
    month: 'jun. 2022',
    state: 'INVOICED',
    quota: 0,
    extra: 0,
    amount: 0,
    amountInvoiced: 0,
    amountProjected: 0,
    amountBudget: 0,
  },
  {
    month: 'jul. 2022',
    state: 'INVOICED',
    quota: 0,
    extra: 0,
    amount: 1995961.8461538465,
    amountInvoiced: 1995961.8461538465,
    amountProjected: 0,
    amountBudget: 0,
  },
];
```
