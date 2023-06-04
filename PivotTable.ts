import {
  Sequelize,
  DataTypes,
  ValidationError,
  DatabaseError,
} from 'sequelize';

type IPivotColumn = {
  caseColumn: string;
  sumColumn: string;
  values?: { [key: string]: string[] };
};

type ColumnDefinition = {
  type: typeof DataTypes.DOUBLE | typeof DataTypes.STRING;
};

type TableDefinition = {
  [columnName: string]: ColumnDefinition;
};

export interface IPivotConf {
  pivotColumn?: IPivotColumn;
  aggregation: string[];
  groupBy?: string[];
  sortBy?: string[];
}

const TEMP_TABLE_NAME = 'temp_rows';

class PivotTable {
  private db: Sequelize;
  private model;
  private tempName: string;

  constructor() {
    this.db = new Sequelize('sqlite::memory:', {
      define: {
        freezeTableName: true,
        timestamps: false,
      },
      logging: false,
    });
    this.authenticateDB();
    this.tempName = TEMP_TABLE_NAME;
  }

  private async authenticateDB() {
    try {
      await this.db.authenticate();
    } catch (error) {
      throw new Error('Unable to connect to the database');
    }
  }

  private getTableDefinition(sample: object): TableDefinition {
    const definition: TableDefinition = {};

    Object.entries(sample).forEach(([key, value]) => {
      definition[key] = {
        type: typeof value === 'number' ? DataTypes.DOUBLE : DataTypes.STRING,
      };
    });

    return definition;
  }

  private async validatePivotConfig(
    pivotConf: IPivotConf,
    definition: TableDefinition,
  ) {
    pivotConf.aggregation.forEach(item => {
      if (!definition.hasOwnProperty(item)) {
        throw new Error(`Invalid aggregation field: ${item}`);
      }
    });

    if (pivotConf.groupBy) {
      pivotConf.groupBy.forEach(item => {
        const [column, alias] = item.split(' AS ');
        if (
          !alias &&
          column.indexOf(' ') === -1 &&
          !definition.hasOwnProperty(column)
        ) {
          throw new Error(`Invalid field in groupBy: ${column}`);
        }

        if (
          alias &&
          !definition.hasOwnProperty(column) &&
          column !== 'null' &&
          column.indexOf(' ') === -1
        ) {
          throw new Error(`Invalid field in groupBy: ${column}`);
        }
      });
    }
    if (pivotConf.sortBy) {
      pivotConf.sortBy.forEach(item => {
        if (!definition.hasOwnProperty(item)) {
          throw new Error(`Invalid sortBy field: ${item}`);
        }
      });
    }
  }

  private async createTable(definition) {
    this.model = this.db.define(this.tempName, definition);
    await this.model.sync();
  }

  private async clearModel() {
    if (this.model) {
      await this.model.destroy({
        truncate: true,
        cascade: false,
        restartIdentity: true,
      });
    }
  }

  private async getSqlCase(pivotColumn: IPivotColumn) {
    const { caseColumn, sumColumn, values } = pivotColumn;
    const arrCase: string[] = [];

    if (values) {
      Object.entries(values).forEach(([key, value]) => {
        arrCase.push(
          `SUM(CASE WHEN ${caseColumn} IN ('${value.join(
            "', '",
          )}') THEN ${sumColumn} ELSE 0 END) AS "${key}"`,
        );
      });
    } else {
      const caseValues = await this.db.query(
        `SELECT DISTINCT ${caseColumn} FROM ${TEMP_TABLE_NAME}`,
        {
          model: this.model,
          mapToModel: true,
          raw: true,
        },
      );

      if (caseValues.length > 150) {
        throw new Error('Column values exceed the limit of 150');
      }

      caseValues.forEach(row => {
        arrCase.push(
          `SUM(CASE WHEN ${caseColumn} = '${row[caseColumn]}' THEN ${sumColumn} ELSE 0 END) AS "${row[caseColumn]}"`,
        );
      });
    }

    return arrCase.join(', ');
  }

  private async getSql(pivotConf: IPivotConf) {
    const { pivotColumn, groupBy, aggregation, sortBy } = pivotConf;
    let selectCase: string[] = [];

    if (pivotColumn) {
      const sqlCases = await this.getSqlCase(pivotColumn);
      if (sqlCases) {
        selectCase = [sqlCases];
      }
    }

    const selectAgg: string[] = aggregation.map((item: string) => {
      const [column, alias = column] = item.split(' AS ');
      return `SUM(${column}) AS ${alias}`;
    });

    const selectArr = [...selectCase, ...selectAgg];
    const groupFieldsSql =
      groupBy && groupBy.length > 0 ? `${groupBy.join(', ')},` : '';

    let sql = `SELECT ${groupFieldsSql} ${selectArr.join(
      ', ',
    )} FROM ${TEMP_TABLE_NAME}`;

    if (groupBy) {
      const groupFields = groupBy.map((item: string) => item.split(' AS ')[0]);
      sql += ` GROUP BY ${groupFields.join(', ')}`;
    }

    if (sortBy) {
      sql += ` ORDER BY ${sortBy.join(', ')}`;
    }

    return sql;
  }

  async getPivotData<T extends object>(data: T[], pivotConf: IPivotConf) {
    try {
      const definition = this.getTableDefinition(data[0]);

      await this.validatePivotConfig(pivotConf, definition);

      await this.createTable(definition);
      await this.model.bulkCreate(data, {
        ignoreDuplicates: true,
      });

      const sql = await this.getSql(pivotConf);

      const pivotData = await this.db.query(sql, {
        model: this.model,
        mapToModel: true,
        raw: true,
      });

      await this.clearModel();

      return pivotData;
    } catch (error) {
      console.error('Unable to process the data:', error);
      let errorMessage =
        'An error occurred while processing your request. Please try again.';
      if (error instanceof DatabaseError) {
        errorMessage =
          'An error occurred while executing the SQL query. Please check your inputs.';
      } else if (error instanceof ValidationError) {
        errorMessage =
          'The provided configuration is invalid. Please check your inputs.';
      }

      throw new Error(errorMessage);
    }
  }

  async getPivotDataFromMultipleConfigurations<T extends object>(
    data: T[],
    configArray: IPivotConf[],
  ): Promise<any[]> {
    const definition = this.getTableDefinition(data[0]);

    await this.createTable(definition);
    await this.model.bulkCreate(data, {
      ignoreDuplicates: true,
    });

    try {
      const results = [];
      for (const pivotConf of configArray) {
        await this.validatePivotConfig(pivotConf, definition);
        const sql = await this.getSql(pivotConf);

        const result = await this.db.query(sql, {
          model: this.model,
          mapToModel: true,
          raw: true,
        });

        results.push(result);
      }
      return results;
    } finally {
      await this.clearModel();
    }
  }
}

export default new PivotTable();
