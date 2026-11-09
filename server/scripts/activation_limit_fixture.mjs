// Adaptador PostgREST mínimo sobre SQL real para probar reservas concurrentes.
export function activationLimitFixture(pg) {
  return { from(table) {
    if (table !== 'account_activation_limits') throw Error('Unexpected table');
    let update, insert, single = false;
    const conditions = [];
    const q = {
      update(value) { update = value; return q; },
      insert(value) { insert = value; return q; },
      select() { return q; },
      eq(key,value) { conditions.push([key,'=',value]); return q; },
      lte(key,value) { conditions.push([key,'<=',value]); return q; },
      maybeSingle() { single = true; return q; },
      then(resolve,reject) { return (async()=>{
        try {
          const values=[];
          const param=value=>{values.push(value);return '$'+values.length;};
          let sql;
          if(insert) sql='INSERT INTO account_activation_limits(key,count,expires_at) VALUES('+[insert.key,insert.count,insert.expires_at].map(param).join(',')+')';
          else {
            sql=update?'UPDATE account_activation_limits SET count='+param(update.count)+',expires_at='+param(update.expires_at):'SELECT * FROM account_activation_limits';
            if(conditions.length)sql+=' WHERE '+conditions.map(([key,op,value])=>key+op+param(value)).join(' AND ');
          }
          if(update||insert)sql+=' RETURNING *';
          const {rows}=await pg.query(sql,values);
          return {data:single?rows[0]||null:rows};
        } catch(error) { return {error:{code:error.code}}; }
      })().then(resolve,reject); }
    };
    return q;
  }};
}
