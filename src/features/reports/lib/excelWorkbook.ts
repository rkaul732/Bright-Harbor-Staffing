export type ExcelCellType = "text" | "date" | "number";

export type ExcelReportColumn<T extends Record<string, unknown>> = {
  header: string;
  key: Extract<keyof T, string>;
  type?: ExcelCellType;
};

type DownloadExcelReportOptions<T extends Record<string, unknown>> = {
  title: string;
  columns: ExcelReportColumn<T>[];
  rows: T[];
  downloadedOn: string;
};

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MIN_TEMPLATE_ROWS = 23;
const DATA_START_ROW = 3;
const DATE_STYLE_ID = 4;
const NUMBER_STYLE_ID = 5;

export function downloadExcelReport<T extends Record<string, unknown>>({
  title,
  columns,
  rows,
  downloadedOn
}: DownloadExcelReportOptions<T>) {
  const blob = createExcelReportBlob({ title, columns, rows });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = sanitizeFileName(title + " - " + downloadedOn) + ".xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function createExcelReportBlob<T extends Record<string, unknown>>({
  title,
  columns,
  rows
}: Omit<DownloadExcelReportOptions<T>, "downloadedOn">) {
  const now = new Date().toISOString();
  const files = [
    { path: "[Content_Types].xml", content: contentTypesXml() },
    { path: "_rels/.rels", content: rootRelationshipsXml() },
    { path: "docProps/app.xml", content: appPropertiesXml() },
    { path: "docProps/core.xml", content: corePropertiesXml(now) },
    { path: "xl/workbook.xml", content: workbookXml() },
    { path: "xl/_rels/workbook.xml.rels", content: workbookRelationshipsXml() },
    { path: "xl/styles.xml", content: stylesXml() },
    { path: "xl/worksheets/sheet1.xml", content: worksheetXml(title, columns, rows) }
  ];

  return new Blob([createZip(files)], { type: XLSX_MIME });
}

function worksheetXml<T extends Record<string, unknown>>(
  title: string,
  columns: ExcelReportColumn<T>[],
  rows: T[]
) {
  const lastColumn = columnName(columns.length);
  const maxRow = Math.max(MIN_TEMPLATE_ROWS, rows.length + DATA_START_ROW - 1);
  const sheetRows: string[] = [];

  sheetRows.push(
    rowXml(
      1,
      columns.map((_, index) =>
        cellXml(columnName(index + 1) + "1", index === 0 ? title : "", 1)
      )
    )
  );

  sheetRows.push(
    rowXml(
      2,
      columns.map((column, index) => cellXml(columnName(index + 1) + "2", column.header, 2))
    )
  );

  for (let rowIndex = DATA_START_ROW; rowIndex <= maxRow; rowIndex += 1) {
    const row = rows[rowIndex - DATA_START_ROW];
    sheetRows.push(
      rowXml(
        rowIndex,
        columns.map((column, columnIndex) => {
          const coordinate = columnName(columnIndex + 1) + String(rowIndex);
          const value = row ? row[column.key] : "";
          const styleId = getDataStyle(column.type);
          return cellXml(coordinate, value, styleId, column.type);
        })
      )
    );
  }

  return xmlDocument(
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<dimension ref="A1:' + lastColumn + String(maxRow) + '"/>' +
      '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="16"/>' +
      '<cols>' +
        columns.map((_, index) => '<col min="' + String(index + 1) + '" max="' + String(index + 1) + '" width="16.3516" customWidth="1"/>').join("") +
      '</cols>' +
      '<sheetData>' + sheetRows.join("") + '</sheetData>' +
      '<mergeCells count="1"><mergeCell ref="A1:' + lastColumn + '1"/></mergeCells>' +
      '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '</worksheet>'
  );
}

function rowXml(rowNumber: number, cells: string[]) {
  const height = rowNumber === 1 ? "22" : rowNumber === 2 ? "28" : "32";
  return '<row r="' + String(rowNumber) + '" ht="' + height + '" customHeight="1">' + cells.join("") + '</row>';
}

function cellXml(
  coordinate: string,
  value: unknown,
  styleId: number,
  type: ExcelCellType = "text"
) {
  if (value === null || value === undefined || value === "") {
    return '<c r="' + coordinate + '" s="' + String(styleId) + '"/>';
  }

  if (type === "number" && typeof value === "number" && Number.isFinite(value)) {
    return '<c r="' + coordinate + '" s="' + String(NUMBER_STYLE_ID) + '"><v>' + String(value) + '</v></c>';
  }

  if (type === "date") {
    const serial = excelDateSerial(String(value));
    if (serial !== null) {
      return '<c r="' + coordinate + '" s="' + String(DATE_STYLE_ID) + '"><v>' + String(serial) + '</v></c>';
    }
  }

  const text = String(value);
  const preserveSpace = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
  return '<c r="' + coordinate + '" s="' + String(styleId) + '" t="inlineStr"><is><t' + preserveSpace + '>' + escapeXml(text) + '</t></is></c>';
}

function getDataStyle(type?: ExcelCellType) {
  if (type === "date") {
    return DATE_STYLE_ID;
  }

  if (type === "number") {
    return NUMBER_STYLE_ID;
  }

  return 3;
}

function excelDateSerial(value: string) {
  const dateText = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const excelEpoch = Date.UTC(1899, 11, 30);
  const dateUtc = Date.UTC(year, month, day);

  return Math.round((dateUtc - excelEpoch) / 86400000);
}

function columnName(index: number) {
  let name = "";
  let current = index;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }

  return name;
}

function stylesXml() {
  return xmlDocument(
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="mm/dd/yy"/></numFmts>' +
      '<fonts count="3">' +
        '<font><sz val="10"/><color rgb="FF1C2F43"/><name val="Helvetica Neue"/></font>' +
        '<font><sz val="12"/><color rgb="FF1C2F43"/><name val="Helvetica Neue"/></font>' +
        '<font><b/><sz val="10"/><color rgb="FF1C2F43"/><name val="Helvetica Neue"/></font>' +
      '</fonts>' +
      '<fills count="3">' +
        '<fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFF7F5AC"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="2">' +
        '<border><left/><right/><top/><bottom/><diagonal/></border>' +
        '<border><left style="thin"><color rgb="FF346990"/></left><right style="thin"><color rgb="FF346990"/></right><top style="thin"><color rgb="FF346990"/></top><bottom style="thin"><color rgb="FF346990"/></bottom><diagonal/></border>' +
      '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="6">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
        '<xf numFmtId="49" fontId="2" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
        '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>' +
    '</styleSheet>'
  );
}

function contentTypesXml() {
  return xmlDocument(
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>'
  );
}

function rootRelationshipsXml() {
  return xmlDocument(
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    '</Relationships>'
  );
}

function workbookXml() {
  return xmlDocument(
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="Sheet 1" sheetId="1" r:id="rId1"/></sheets>' +
    '</workbook>'
  );
}

function workbookRelationshipsXml() {
  return xmlDocument(
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>'
  );
}

function appPropertiesXml() {
  return xmlDocument(
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      '<Application>Bright Harbor Staffing</Application>' +
      '<DocSecurity>0</DocSecurity>' +
      '<ScaleCrop>false</ScaleCrop>' +
      '<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs>' +
      '<TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>Sheet 1</vt:lpstr></vt:vector></TitlesOfParts>' +
    '</Properties>'
  );
}

function corePropertiesXml(isoDate: string) {
  return xmlDocument(
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:creator>Bright Harbor Staffing</dc:creator>' +
      '<cp:lastModifiedBy>Bright Harbor Staffing</cp:lastModifiedBy>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + isoDate + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + isoDate + '</dcterms:modified>' +
    '</cp:coreProperties>'
  );
}

function xmlDocument(body: string) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + body;
}

function createZip(files: { path: string; content: string }[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);
    const localHeader = createLocalHeader(nameBytes, dataBytes, crc);
    const centralHeader = createCentralHeader(nameBytes, dataBytes, crc, offset);

    localParts.push(localHeader, dataBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  });

  const centralDirectoryOffset = offset;
  const centralDirectory = concatUint8Arrays(centralParts);
  const endRecord = createEndRecord(files.length, centralDirectory.length, centralDirectoryOffset);

  return concatUint8Arrays([...localParts, centralDirectory, endRecord]);
}

function createLocalHeader(nameBytes: Uint8Array, dataBytes: Uint8Array, crc: number) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, dataBytes.length, true);
  view.setUint32(22, dataBytes.length, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  header.set(nameBytes, 30);

  return header;
}

function createCentralHeader(
  nameBytes: Uint8Array,
  dataBytes: Uint8Array,
  crc: number,
  localHeaderOffset: number
) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, dataBytes.length, true);
  view.setUint32(24, dataBytes.length, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localHeaderOffset, true);
  header.set(nameBytes, 46);

  return header;
}

function createEndRecord(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true);

  return header;
}

function concatUint8Arrays(arrays: Uint8Array[]) {
  const totalLength = arrays.reduce((sum, item) => sum + item.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  arrays.forEach((array) => {
    result.set(array, offset);
    offset += array.length;
  });

  return result;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
