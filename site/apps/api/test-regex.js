const out = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path=".bootstrap.cjs" verb="*" modules="iisnode" resourceType="Unspecified" />
    </handlers>
    <rewrite>
      <rules>
        <rule name="RoboSphereApp" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url=".bootstrap.cjs" />
        </rule>
      </rules>
    </rewrite>
    <iisnode
      nodeProcessCommandLine="C:\\Program Files\\nodejs\\node.exe"
      devErrorsEnabled="false"
      loggingEnabled="true"
      logDirectory="..\\logs"
      nodeProcessCountPerApplication="1"
    />
    <httpErrors existingResponse="PassThrough" />
</system.webServer>
  <system.web>
    <compilation tempDirectory="C:\\Inetpub\\vhosts\\bhartitechnical.com\\tmp" />
  </system.web>
</configuration>
`;

let changed = false;

const next1 = out.replace(/path="\.bootstrap\.cjs"/gi, 'path="dist/index.mjs"');
const next2 = next1.replace(/url="\.bootstrap\.cjs"/gi, 'url="dist/index.mjs"');
const next3 = next2.replace(/path="app\.js"/gi, 'path="dist/index.mjs"');
const next4 = next3.replace(/url="app\.js"/gi, 'url="dist/index.mjs"');

if (next4 !== out) {
    changed = true;
}

console.log("CHANGED?", changed);
console.log(next4);
