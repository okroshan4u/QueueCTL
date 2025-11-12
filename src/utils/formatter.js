// src/utils/formatter.js

function formatTable(rows) {
  const colWidths = [];
  rows.forEach((row) => {
    row.forEach((cell, i) => {
      const len = String(cell).length;
      colWidths[i] = Math.max(colWidths[i] || 0, len);
    });
  });

  return rows
    .map((row) =>
      row
        .map((cell, i) => String(cell).padEnd(colWidths[i]))
        .join("   ")
    )
    .join("\n");
}

function formatJson(obj) {
  return JSON.stringify(obj, null, 2);
}

module.exports = { formatTable, formatJson };
