import { Sequelize, DataTypes, Model } from 'sequelize';
import { sample, mapKeys, isNumber } from 'lodash';

type IPivotColumn = {
  caseColumn: string;
  sumColumn: string;
  values?: {};
};

export interface IPivotConf {
  pivotColumn?: IPivotColumn;
  aggregation: string[];
  groupBy?: string[];
  sortBy?: string[];
}

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
    this.tempName = 'temp_rows';
  }

  private getTableDefinition = (sample: object) => {
    const definition = [];

    mapKeys(sample, (value, key: string) => {
      if (isNumber(value)) {
        definition[key] = {
          type: DataTypes.DOUBLE,
        };
      } else {
        definition[key] = {
          type: DataTypes.STRING,
        };
      }
    });

    return definition;
  };

  private createTable = async (definition) => {
    return this.db
      .authenticate()
      .then(async () => {
        this.model = this.db.define(this.tempName, definition);
        await this.model.sync();
      })
      .catch(() => {
        throw 'Unable to connect to temporal database ';
      });
  };

  private getSqlCase = async (pivotColumn: IPivotColumn) => {
    const { caseColumn, sumColumn, values } = pivotColumn;
    const arrCase: string[] = [];
    if (!!values) {
      mapKeys(values, (value: string[], key: string) => {
        return arrCase.push(
          ` SUM (CASE WHEN ${caseColumn} in ('${value.join("', '")}') THEN "${sumColumn}" ELSE 0 END) AS "${key}"`,
        );
      });
    } else {
      const caseValues: string[] = await this.db.query(`SELECT DISTINCT ${caseColumn} FROM temp_rows`, {
        model: this.model,
        mapToModel: true,
        raw: true,
      });

      if (caseValues.length > 150) {
        throw 'Column values exceed the limit of 150';
      }

      caseValues.forEach((row) => {
        arrCase.push(
          `SUM (CASE WHEN ${caseColumn} = '${row[caseColumn]}' THEN "${sumColumn}" ELSE 0 END) AS "${row[caseColumn]}"`,
        );
      });
    }

    return arrCase.join(', ');
  };

  private getSql = async (pivotConf: IPivotConf) => {
    const { pivotColumn, groupBy, aggregation, sortBy } = pivotConf;
    const selectCase: string[] = [];
    if (!!pivotColumn) {
      const sqlCases = await this.getSqlCase(pivotColumn);
      if (!!sqlCases) {
        selectCase.push(sqlCases);
      }
    }

    const regex = new RegExp(' AS ');
    const selectAgg: string[] = aggregation.reduce((accum: string[], item: string) => {
      const [column, alias] = regex.test(item) ? item.split(' AS ') : [item, item];
      accum.push(`SUM (${column}) AS ${alias}`);
      return accum;
    }, []);

    const selectArr = selectCase.concat(selectAgg);

    const groupFieldsSql = !!groupBy && groupBy?.length > 0 ? `${groupBy.join(', ')},` : '';

    let sql = `SELECT ${groupFieldsSql} ${selectArr.join(', ')} FROM temp_rows`;

    if (!!groupBy) {
      const groupFields = groupBy.reduce((accum: string[], item: string) => {
        const [fieldName] = item.split(' AS ');
        accum.push(fieldName);
        return accum;
      }, []);
      sql += ` GROUP BY ${groupFields.join(', ')}`;
    }

    if (!!sortBy) {
      sql += ` ORDER BY ${sortBy.join(', ')}`;
    }

    return sql;
  };

  initModel = async () => {
    if (!!this.model) {
      await this.model.destroy({ truncate: true, cascade: false, restartIdentity: true });
    }
  };

  getPivotData = async <T>(data: T[], pivotConf: IPivotConf) => {
    try {
      const definition = this.getTableDefinition(sample(data));
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

      await this.model.destroy({ truncate: true, cascade: false, restartIdentity: true });

      return pivotData;
    } catch (error) {
      console.error('Unable to connect to the database:', error);
    }
  };
}

export default new PivotTable();
