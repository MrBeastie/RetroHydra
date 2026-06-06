fn main() {
    if std::env::var("RETROHYDRA_PACKAGE_SMOKE").as_deref() == Ok("1") {
        if let Err(error) = retrohydra_lib::run_package_smoke() {
            eprintln!("RetroHydra package smoke failed: {error}");
            std::process::exit(1);
        }
        return;
    }

    retrohydra_lib::run()
}
