"""Unit tests for compliance repository helpers (pure shape tests)."""
from services.compliance.repositories import (
    get_project,
    list_project_urls,
    replace_project_urls,
    list_job_ids_for_project,
    delete_audits_for_jobs,
    delete_jobs_for_project,
)


def test_repository_exports_are_callable():
    assert callable(get_project)
    assert callable(list_project_urls)
    assert callable(replace_project_urls)
    assert callable(list_job_ids_for_project)
    assert callable(delete_audits_for_jobs)
    assert callable(delete_jobs_for_project)
